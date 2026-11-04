// Holding analysis payload (GET /api/holdings/analysis/[ticker], report page).
//
// Built from the committed issuer cache only — no CVM/IR/PDF access, no
// refresh. The requested share class (ITSA3, BRAP3, …) and the canonical
// issuer cache (ITSA4, BRAP4) stay distinct: fundamentals are issuer-wide,
// quotes are fetched per requested ticker by the existing market-data layer
// and are never part of this payload.
//
// Descriptive only: the official discount is the issuer's published structural
// metric — never a fair value, target, upside or recommendation.
//
// Pure and client-safe (no fs). No @/ imports — also used by tsx scripts.

import { resolveHoldingCacheTicker } from "./holding-identities";
import { assessHoldingCache } from "./holding-readiness";
import type {
  EnrichmentStatus,
  HoldingCache,
  HoldingIndicators,
  HoldingIssuer,
  HoldingPortfolioComponent,
  HoldingReferenceDates,
  HoldingShareClass,
  HoldingStatement,
  MixedBasisPart,
  OfficialDiscount,
  OfficialMarketValue,
  PortfolioFreshness,
  PortfolioSourceKind,
  PortfolioValueBasis,
  ShortTermInvestmentClassification,
} from "./holding-types";

// ─── Payload types ────────────────────────────────────────────────────────────

export interface HoldingComponentView {
  name: string;
  kind: HoldingPortfolioComponent["kind"];
  ticker: string | null;
  listed: boolean;
  /** As published by the issuer (fraction). */
  ownershipPct: number | null;
  ownershipReferenceDate: string | null;
  /** BRL. */
  value: number;
  valueBasis: PortfolioValueBasis;
  valueReferenceDate: string | null;
  pricePerShare: number | null;
  sharesHeld: number | null;
  parts: Pick<MixedBasisPart, "basis" | "value" | "referenceDate">[] | null;
  /** value / Σ positive investee values — investees with a positive value only, else null. */
  shareOfPositiveInvestees: number | null;
}

export interface HoldingPortfolioView {
  sourceKind: PortfolioSourceKind;
  sourceTitle: string;
  portfolioReferenceDate: string;
  portfolioPublicationDate: string | null;
  /** kind = investment, in publication order. */
  investees: HoldingComponentView[];
  /** Reconciliation lines that are not investees (e.g. Itaúsa "Demais Ativos e Passivos"). */
  otherAssetsLiabilities: HoldingComponentView[];
  /** Net cash printed in the portfolio publication (Bradespar bulletin); input to the
   *  official portfolio value only — never the statement cash/net debt. */
  publishedNetCash: { value: number; referenceDate: string } | null;
  /** Σ positive investee values (concentration denominator). */
  positiveInvesteeTotal: number;
  officialPortfolioValue: number;
  officialMarketValue: OfficialMarketValue;
  officialDiscount: OfficialDiscount;
  standardizedClassWeightedMarketCap: number | null;
  validation: { status: "passed" | "failed"; checksPassed: number; checksTotal: number };
}

export interface HoldingStatementView {
  periodEnd: string;
  document: "DFP" | "ITR";
  fiscalYear: number;
  quarter: 1 | 2 | 3 | 4;
  filingDate: string | null;
  filingVersion: number;
  basis: "individual";
  cash: number | null;
  /** CVM 1.01.02 — never part of cash. */
  shortTermInvestments: { value: number; classification: ShortTermInvestmentClassification; includedInCash: false } | null;
  equityStakes: number | null;
  grossDebt: number | null;
  /** grossDebt − cash at periodEnd (negative = net cash). */
  netDebt: number | null;
  equity: number | null;
  generalAdministrativeExpensesYtd: number | null;
  equityMethodIncomeYtd: number | null;
  financialExpensesYtd: number | null;
  netIncomeYtd: number | null;
  dividendsReceivedYtd: number | null;
  /** True when some fields of this statement were left null by a failed check. */
  hasIssues: boolean;
}

export type HoldingNoticeCode =
  | "portfolio_preserved"
  | "portfolio_stale"
  | "portfolio_missing"
  | "statements_preserved"
  | "statement_fields_missing"
  | "mixed_value_bases"
  | "published_ownership_denominator"
  | "market_value_method"
  | "statement_vs_publication_dates";

/** User-facing (Portuguese) note. "warning" = data limitation; "info" = methodology. */
export interface HoldingNotice {
  code: HoldingNoticeCode;
  severity: "info" | "warning";
  message: string;
}

export interface HoldingSourceRef {
  name: string;
  detail: string;
  url: string;
}

export interface HoldingAnalysisAvailable {
  available: true;
  source: "holding_analysis";
  requestedTicker: string;
  canonicalTicker: string;
  issuer: HoldingIssuer;
  requestedShareClass: HoldingShareClass;
  shareClasses: HoldingShareClass[];
  statement: HoldingStatementView | null;
  portfolio: HoldingPortfolioView | null;
  indicators: HoldingIndicators;
  referenceDates: HoldingReferenceDates;
  freshness: PortfolioFreshness;
  enrichment: { statements: EnrichmentStatus; portfolio: EnrichmentStatus };
  /** ready = full holding analysis; limited = usable cache with a data limitation (see notices). */
  analysisStatus: "ready" | "limited";
  notices: HoldingNotice[];
  sources: HoldingSourceRef[];
  updatedAt: string;
}

export interface HoldingAnalysisUnavailable {
  available: false;
  source: "holding_analysis";
  requestedTicker: string;
  canonicalTicker: string | null;
  reason: "unsupported_ticker" | "cache_unavailable";
  message: string;
}

export type HoldingAnalysisResponse = HoldingAnalysisAvailable | HoldingAnalysisUnavailable;

// ─── Builders ─────────────────────────────────────────────────────────────────

function componentView(c: HoldingPortfolioComponent, positiveTotal: number): HoldingComponentView {
  return {
    name: c.name,
    kind: c.kind,
    ticker: c.ticker,
    listed: c.listed,
    ownershipPct: c.ownershipPct,
    ownershipReferenceDate: c.ownershipReferenceDate,
    value: c.value,
    valueBasis: c.valueBasis,
    valueReferenceDate: c.valueReferenceDate,
    pricePerShare: c.pricePerShare,
    sharesHeld: c.sharesHeld,
    parts: c.parts?.map(p => ({ basis: p.basis, value: p.value, referenceDate: p.referenceDate })) ?? null,
    shareOfPositiveInvestees: c.kind === "investment" && c.value > 0 && positiveTotal > 0 ? c.value / positiveTotal : null,
  };
}

function portfolioView(cache: HoldingCache): HoldingPortfolioView | null {
  const p = cache.portfolio;
  if (!p) return null;
  const positiveTotal = p.components.filter(c => c.kind === "investment" && c.value > 0).reduce((s, c) => s + c.value, 0);
  return {
    sourceKind: p.source.kind,
    sourceTitle: p.source.title,
    portfolioReferenceDate: p.portfolioReferenceDate,
    portfolioPublicationDate: p.portfolioPublicationDate,
    investees: p.components.filter(c => c.kind === "investment").map(c => componentView(c, positiveTotal)),
    otherAssetsLiabilities: p.components.filter(c => c.kind === "other_assets_liabilities").map(c => componentView(c, positiveTotal)),
    publishedNetCash: p.publishedNetCash ? { value: p.publishedNetCash.value, referenceDate: p.publishedNetCash.referenceDate } : null,
    positiveInvesteeTotal: positiveTotal,
    officialPortfolioValue: p.officialPortfolioValue,
    officialMarketValue: p.officialMarketValue,
    officialDiscount: p.officialDiscount,
    standardizedClassWeightedMarketCap: p.standardizedClassWeightedMarketCap,
    validation: {
      status: p.validation.status,
      checksPassed: p.validation.checks.filter(c => c.passed).length,
      checksTotal: p.validation.checks.length,
    },
  };
}

function statementView(st: HoldingStatement | null): HoldingStatementView | null {
  if (!st) return null;
  return {
    periodEnd: st.periodEnd,
    document: st.document,
    fiscalYear: st.fiscalYear,
    quarter: st.quarter,
    filingDate: st.filingDate,
    filingVersion: st.filingVersion,
    basis: st.basis,
    cash: st.cash,
    shortTermInvestments: st.shortTermInvestments
      ? { value: st.shortTermInvestments.value, classification: st.shortTermInvestments.classification, includedInCash: false }
      : null,
    equityStakes: st.equityStakes,
    grossDebt: st.grossDebt,
    netDebt: st.netDebt,
    equity: st.equity,
    generalAdministrativeExpensesYtd: st.generalAdministrativeExpensesYtd,
    equityMethodIncomeYtd: st.equityMethodIncomeYtd,
    financialExpensesYtd: st.financialExpensesYtd,
    netIncomeYtd: st.netIncomeYtd,
    dividendsReceivedYtd: st.dividendsReceivedYtd,
    hasIssues: st.issues.length > 0,
  };
}

const ptDate = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "data não informada");

function noticesFor(cache: HoldingCache, statement: HoldingStatementView | null, portfolio: HoldingPortfolioView | null): HoldingNotice[] {
  const notices: HoldingNotice[] = [];
  const warn = (code: HoldingNoticeCode, message: string) => notices.push({ code, severity: "warning", message });
  const info = (code: HoldingNoticeCode, message: string) => notices.push({ code, severity: "info", message });

  if (!portfolio) {
    warn("portfolio_missing", "Retrato oficial do portfólio indisponível no momento — indicadores de portfólio e desconto oficial não são exibidos.");
  } else {
    if (cache.enrichment.portfolio === "preserved") {
      warn("portfolio_preserved", `A publicação do portfólio não pôde ser atualizada na última coleta; é exibido o último retrato validado (referência ${ptDate(portfolio.portfolioReferenceDate)}).`);
    }
    if (cache.portfolioFreshness.status === "stale") {
      warn("portfolio_stale", `O retrato do portfólio (referência ${ptDate(portfolio.portfolioReferenceDate)}) é mais antigo que o trimestre seguinte à última demonstração (${ptDate(cache.portfolioFreshness.statementReferenceDate)}).`);
    }
  }
  if (cache.enrichment.statements === "preserved") {
    warn("statements_preserved", "As demonstrações da CVM não puderam ser atualizadas na última coleta; é exibido o histórico já validado.");
  }
  if (statement?.hasIssues) {
    warn("statement_fields_missing", "Algumas contas da demonstração mais recente não passaram nas verificações e aparecem como N/D.");
  }

  if (portfolio) {
    const bases = new Set(portfolio.investees.map(c => c.valueBasis));
    if (bases.size > 1) {
      info("mixed_value_bases", "Os valores das investidas seguem bases de mensuração diferentes, conforme publicado pela companhia (preço de mercado, preço de transação, valor contábil, valor justo contabilizado). Nem todas as participações estão marcadas a mercado.");
    }
    if (portfolio.sourceKind === "bradespar_boletim_quinzenal") {
      const stake = portfolio.investees.find(c => c.ownershipPct !== null);
      if (stake) {
        info("published_ownership_denominator", `A participação de ${(stake.ownershipPct! * 100).toFixed(2).replace(".", ",")}% em ${stake.name} é exibida como publicada no boletim (nota "Não considera ações em tesouraria"). Pelos dados de ações da CVM, esse percentual só é reproduzido incluindo as ações em tesouraria de ${stake.name} no denominador. O percentual não entra em nenhum cálculo: o valor da participação usa a quantidade de ações publicada.`);
      }
    }
    if (portfolio.officialMarketValue.method === "most_liquid_class_price_times_total_ex_treasury_shares") {
      const cls = portfolio.officialMarketValue.classes[0];
      info("market_value_method", `Valor de mercado oficial calculado pela companhia: preço de ${cls?.ticker ?? "classe mais líquida"} × total de ações (ON e PN) excluídas as em tesouraria.`);
    } else {
      info("market_value_method", "Valor de mercado oficial calculado pela companhia: soma, por classe, do preço de fechamento × ações da classe excluídas as em tesouraria.");
    }
    if (statement && statement.periodEnd !== portfolio.portfolioReferenceDate) {
      info("statement_vs_publication_dates", `Caixa, dívida e resultados vêm da demonstração individual de ${ptDate(statement.periodEnd)}; ${portfolio.publishedNetCash ? "o portfólio e o caixa líquido publicado referem-se" : "o portfólio refere-se"} a ${ptDate(portfolio.portfolioReferenceDate)}. As datas são exibidas separadamente e não são combinadas.`);
    }
  }
  return notices;
}

function sourcesFor(cache: HoldingCache, portfolio: HoldingPortfolioView | null): HoldingSourceRef[] {
  const sources: HoldingSourceRef[] = [{
    name: "CVM Dados Abertos",
    detail: "DFP/ITR, demonstrações individuais da controladora e composição do capital",
    url: "https://dados.cvm.gov.br/dataset/cia_aberta-doc-itr",
  }];
  if (portfolio && cache.provenance.portfolio) {
    sources.push(portfolio.sourceKind === "itausa_portfolio_page"
      ? { name: "Itaúsa RI", detail: "Valor do Portfólio e Desconto", url: cache.provenance.portfolio }
      : { name: "Bradespar RI — Boletim Quinzenal", detail: portfolio.sourceTitle, url: cache.provenance.portfolio });
  }
  return sources;
}

export function buildHoldingAnalysisResponse(requestedTicker: string, cache: HoldingCache | null): HoldingAnalysisResponse {
  const requested = requestedTicker.toUpperCase();
  const canonical = resolveHoldingCacheTicker(requested);
  if (!canonical) {
    return {
      available: false, source: "holding_analysis", requestedTicker: requested, canonicalTicker: null,
      reason: "unsupported_ticker", message: "Ticker fora do modelo de holdings.",
    };
  }
  const assessment = assessHoldingCache(requested, cache);
  const requestedShareClass = cache?.shareClasses.find(c => c.ticker === requested);
  if (!cache || assessment.status === "unusable" || !requestedShareClass) {
    return {
      available: false, source: "holding_analysis", requestedTicker: requested, canonicalTicker: canonical,
      reason: "cache_unavailable", message: "Dados do modelo de holdings ainda não disponíveis para este ativo.",
    };
  }

  const statement = statementView(cache.statements[cache.statements.length - 1] ?? null);
  const portfolio = portfolioView(cache);
  return {
    available: true,
    source: "holding_analysis",
    requestedTicker: requested,
    canonicalTicker: canonical,
    issuer: cache.issuer,
    requestedShareClass,
    shareClasses: cache.shareClasses,
    statement,
    portfolio,
    indicators: cache.indicators,
    referenceDates: cache.referenceDates,
    freshness: cache.portfolioFreshness,
    enrichment: { statements: cache.enrichment.statements, portfolio: cache.enrichment.portfolio },
    analysisStatus: assessment.status === "ready" ? "ready" : "limited",
    notices: noticesFor(cache, statement, portfolio),
    sources: sourcesFor(cache, portfolio),
    updatedAt: cache.updatedAt,
  };
}
