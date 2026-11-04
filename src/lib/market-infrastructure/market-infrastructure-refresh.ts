// Market-infrastructure cache refresh policy — pure.
//
//   CVM ok,    workbook ok    → statements advance; the workbook is accepted
//                               only after its same-quarter revenue cross-check.
//   CVM ok,    workbook fails → statements advance; the previous validated KPI
//                               snapshot is kept as-is ("preserved").
//   CVM fails, workbook ok    → previous statement history kept ("preserved");
//                               the workbook is accepted only if the preserved
//                               history has its quarter — never paired with a
//                               statement of another quarter.
//   both fail                 → nothing is written over the previous cache.
//   no previous cache         → written only when CVM succeeded.
//
// Statement history is merged by period (new filings win), so a refresh can
// never shorten it. An older workbook never replaces a newer validated one.
// A segment taxonomy change invalidates only the latest-filing segment block
// (older validated snapshots stay; enrichment.segments = "failed").
//
// No @/ imports — also used by tsx scripts.

import type { RawFiling } from "./market-infrastructure-cvm-rows";
import type { ParsedB3Workbook } from "./b3-workbook";
import type { MarketInfrastructureIdentity } from "./market-infrastructure-identity";
import { buildFinancialPosition } from "./market-infrastructure-financial-position";
import { collectSegmentCandidates, selectSegmentHistory } from "./market-infrastructure-segments";
import { validateOperatingMetrics } from "./market-infrastructure-kpis";
import { buildCapitalAllocation, normalizeShareCounts } from "./market-infrastructure-capital";
import { computeMarketInfrastructureIndicators } from "./market-infrastructure-indicators";
import {
  MARKET_INFRASTRUCTURE_CACHE_SCHEMA_VERSION,
  type EnrichmentStatus,
  type MarketInfrastructureCache,
  type MarketInfrastructureStatement,
  type OperatingMetricsSnapshot,
  type RevenueSegmentSnapshot,
  type ShareCountSnapshot,
  type WorkbookSource,
} from "./market-infrastructure-types";

export type SourceOutcome<T> = { ok: true; value: T } | { ok: false; error: string };

export interface CvmOutcome {
  statements: MarketInfrastructureStatement[];
  filings: RawFiling[];
  shareCounts: ShareCountSnapshot[];
  sources: string[];
}

export interface WorkbookInput {
  parsed: ParsedB3Workbook;
  source: WorkbookSource;
}

export interface MarketInfrastructureRefreshInput {
  identity: MarketInfrastructureIdentity;
  /** Registry DENOM_SOCIAL; falls back to the previous cache, then the verified name. */
  legalName: string | null;
  previous: MarketInfrastructureCache | null;
  cvm: SourceOutcome<CvmOutcome>;
  workbook: SourceOutcome<WorkbookInput>;
  updatedAt: string;
}

export interface MarketInfrastructureRefreshResult {
  cache: MarketInfrastructureCache | null;
  write: boolean;
  reason: string;
}

export const REGISTRY_URL = "https://dados.cvm.gov.br/dados/CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv";

export const STATEMENTS_PRESERVED_WARNING = "Demonstrações CVM indisponíveis — mantido o histórico anterior.";
export const KPI_PRESERVED_WARNING = "Planilha oficial de dados trimestrais indisponível ou não validada — mantido o último retrato validado.";
export const SEGMENTS_INVALID_WARNING = "Segmentos de receita do último arquivamento não reconhecidos ou não conciliados — composição atual indisponível.";

export const METHODOLOGY_NOTES: readonly string[] = [
  "Base consolidada (inclui Banco B3, controladas de dados/tecnologia e fundos exclusivos).",
  "3.02 contém apenas impostos sobre a receita (PIS/Cofins, ISS): 3.03 é a receita líquida e não existe margem bruta.",
  "Resultado operacional = receita líquida (3.03) + despesas (3.04.02); EBITDA = resultado operacional + depreciação e amortização (DFC) — o EBITDA operacional reportado pela B3. O EBIT contábil (3.05) fica armazenado, mas não entra no EBITDA: inclui itens fora do resultado operacional da B3 (no 2T26, o ganho na alienação da Dimensa e a equivalência patrimonial).",
  "Distribuições: linhas duplicadas de \"Pagamento de Proventos\" no mesmo período não são somadas; o período fica nulo (FY2023, 1T19).",
  "Estoques médios de renda fixa e crédito: três componentes oficiais, sem agregado (a B3 não publica um total).",
  "Caixa da DFC (6.05.02) é campo secundário/de proveniência; a leitura como caixa próprio só foi validada para 2026-06-30 e o valor não entra em posição financeira, alavancagem ou liquidez.",
  "Segmentos: taxonomia atual (a partir do FY2024 reapresentado), um único arquivamento por período, sem TTM por segmento.",
  "Indicadores operacionais e preços unitários (RPC, margem em bps) são os publicados pela B3; nenhuma taxa de captura é derivada.",
  "Fluxo de caixa operacional da CVM inclui aplicações financeiras e garantias de terceiros e não é usado como medida de desempenho; não há FCF.",
  "Valores de efeito hedge e recorrentes ajustados pela companhia não são aplicados; os valores são os reportados.",
];

function mergeStatements(previous: readonly MarketInfrastructureStatement[], fresh: readonly MarketInfrastructureStatement[]) {
  const byPeriod = new Map(previous.map(s => [s.periodEnd, s]));
  for (const s of fresh) byPeriod.set(s.periodEnd, s);
  return [...byPeriod.values()].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
}

export function refreshMarketInfrastructureCache(input: MarketInfrastructureRefreshInput): MarketInfrastructureRefreshResult {
  const { identity, previous, cvm, workbook: wb } = input;
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!cvm.ok && !wb.ok && previous) {
    return { cache: null, write: false, reason: `CVM and workbook sources failed (${cvm.error}; ${wb.error}) — previous cache kept` };
  }

  // Statements, share counts, segments.
  let statements: MarketInfrastructureStatement[];
  let statementsStatus: EnrichmentStatus;
  let shareCounts: ShareCountSnapshot[];
  let revenueSegments: RevenueSegmentSnapshot[];
  let segmentsStatus: EnrichmentStatus;
  let statementSources: string[];
  if (cvm.ok && cvm.value.statements.length > 0) {
    statements = mergeStatements(previous?.statements ?? [], cvm.value.statements);
    statementsStatus = "ok";
    shareCounts = normalizeShareCounts([...(previous?.shareCounts ?? []), ...cvm.value.shareCounts]);
    if (cvm.value.shareCounts.length === 0) issues.push("composicao_capital not found in CVM filings");
    statementSources = [...new Set([...(previous?.sources.statements ?? []), ...cvm.value.sources])].sort();

    const latestEnd = statements[statements.length - 1].periodEnd;
    const candidates = collectSegmentCandidates(cvm.value.filings);
    candidates.snapshots.unshift(...(previous?.revenueSegments ?? []));
    const selection = selectSegmentHistory(candidates, latestEnd);
    revenueSegments = selection.snapshots;
    segmentsStatus = selection.latestValid ? "ok" : "failed";
    issues.push(...selection.issues);
    if (!selection.latestValid) warnings.push(SEGMENTS_INVALID_WARNING);
  } else {
    const error = cvm.ok ? "no consolidated statements extracted" : cvm.error;
    if (!previous) return { cache: null, write: false, reason: `CVM statements unavailable and no previous cache (${error})` };
    statements = previous.statements;
    statementsStatus = "preserved";
    shareCounts = previous.shareCounts;
    revenueSegments = previous.revenueSegments;
    segmentsStatus = "preserved";
    statementSources = previous.sources.statements;
    issues.push(`CVM unavailable (${error}); previous statement history preserved`);
    warnings.push(STATEMENTS_PRESERVED_WARNING);
  }

  // Workbook KPIs.
  const prevKpis = previous?.operatingMetrics ?? null;
  let operatingMetrics: OperatingMetricsSnapshot | null = null;
  let kpiStatus: EnrichmentStatus;
  const keepPrevious = (why: string) => {
    if (prevKpis) {
      operatingMetrics = prevKpis;
      kpiStatus = "preserved";
      issues.push(`${why}; previous validated KPI snapshot ${prevKpis.quarterLabel} preserved`);
      warnings.push(KPI_PRESERVED_WARNING);
    } else {
      operatingMetrics = null;
      kpiStatus = "failed";
      issues.push(`${why}; no validated KPI snapshot available`);
      warnings.push("Indicadores operacionais oficiais indisponíveis.");
    }
  };
  kpiStatus = "failed";
  if (!wb.ok) {
    keepPrevious(`workbook source failed (${wb.error})`);
  } else {
    const validation = validateOperatingMetrics(wb.value.parsed, wb.value.source, statements);
    if (!validation.ok) keepPrevious(`workbook ${wb.value.parsed.quarterLabel} rejected: ${validation.reason}`);
    else if (prevKpis && validation.snapshot.quarterEnd < prevKpis.quarterEnd) {
      keepPrevious(`workbook ${validation.snapshot.quarterLabel} is older than the cached ${prevKpis.quarterLabel}`);
    } else {
      operatingMetrics = validation.snapshot;
      kpiStatus = "ok";
    }
  }
  const kpis = operatingMetrics as OperatingMetricsSnapshot | null;

  const latest = statements[statements.length - 1];
  const financialPosition = buildFinancialPosition(latest);
  const capitalAllocation = buildCapitalAllocation(statements, shareCounts);
  const indicators = computeMarketInfrastructureIndicators({ statements, revenueSegments, operatingMetrics: kpis, financialPosition, capitalAllocation, shareCounts });

  warnings.push(...latest.issues.filter(i => !i.startsWith("note:")).map(i => `${latest.periodEnd}: ${i}`));
  warnings.push(...financialPosition.issues.map(i => `${latest.periodEnd}: ${i}`));
  warnings.push(...capitalAllocation.issues);
  if (kpis && kpis.quarterEnd !== latest.periodEnd) {
    warnings.push(`Indicadores operacionais (${kpis.quarterLabel}) não correspondem ao trimestre das demonstrações (${latest.periodEnd}).`);
  }
  for (const r of kpis?.officialReconciliation ?? []) {
    if (r.passed === false) warnings.push(`${r.label}: planilha ${r.workbook} vs reproduzido ${r.reproduced} (diferença ${r.difference})`);
  }

  const segmentRef = revenueSegments.filter(s => s.source.filingReferenceDate === latest.periodEnd && !s.source.comparative);
  const currentSegment = segmentRef.find(s => s.periodKind === "quarter") ?? segmentRef.find(s => s.periodKind === "fy") ?? segmentRef[0] ?? null;
  const latestShares = shareCounts[shareCounts.length - 1] ?? null;
  const shareClass = { ticker: identity.ticker, kind: identity.shareClassKind, isin: identity.isin };

  const cache: MarketInfrastructureCache = {
    schemaVersion: MARKET_INFRASTRUCTURE_CACHE_SCHEMA_VERSION,
    ticker: identity.ticker,
    source: "market_infrastructure_analysis",
    issuer: {
      ticker: identity.ticker,
      cvmCode: identity.cvmCode,
      cnpj: identity.cnpj,
      legalName: input.legalName ?? previous?.issuer.legalName ?? identity.legalName,
      tradingName: identity.tradingName,
      registration: identity.registration,
      statementBasis: "consolidated",
    },
    shareClass,
    shareCounts,
    statements,
    latestStatement: { periodEnd: latest.periodEnd, document: latest.document, filingDate: latest.filingDate, filingVersion: latest.filingVersion },
    revenueSegments,
    operatingMetrics: kpis,
    financialPosition,
    capitalAllocation,
    indicators,
    referenceDates: {
      statementReferenceDate: latest.periodEnd,
      filingDate: latest.filingDate,
      filingVersion: latest.filingVersion,
      segmentReferencePeriod: currentSegment ? { periodStart: currentSegment.periodStart, periodEnd: currentSegment.periodEnd, periodKind: currentSegment.periodKind } : null,
      workbookQuarter: kpis?.quarterLabel ?? null,
      workbookPublicationDate: kpis?.source.publishedDate ?? null,
      financialPositionReferenceDate: financialPosition.referenceDate,
      shareCountReferenceDate: latestShares?.referenceDate ?? null,
      capitalAllocationReferencePeriod: capitalAllocation.referencePeriod,
    },
    sources: { statements: statementSources, workbook: kpis?.source.url ?? null, registry: REGISTRY_URL },
    enrichment: { statements: statementsStatus, segments: segmentsStatus, operatingMetrics: kpiStatus, issues },
    methodologyNotes: [...METHODOLOGY_NOTES, ...(kpis?.notes.filter(n => !n.startsWith("issue:")) ?? [])],
    warnings,
    updatedAt: input.updatedAt,
  };
  return { cache, write: true, reason: `statements ${statementsStatus}, segments ${segmentsStatus}, operating metrics ${kpiStatus}` };
}
