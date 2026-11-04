// Holding cache refresh policy — pure, per issuer.
//
//   CVM ok,   portfolio ok    → both advance.
//   CVM ok,   portfolio fails → statements advance; the previous validated
//                               snapshot is kept as-is (status "preserved").
//   CVM fails, portfolio ok   → previous statement history kept ("preserved");
//                               the new snapshot is used.
//   both fail                 → nothing is written over the previous cache.
//   no previous cache         → written only when CVM succeeded; a missing
//                               portfolio stays null (never invented).
//
// Statement history is merged by period (new filings win), so a refresh can
// never shorten it. An older portfolio snapshot never replaces a newer one.
//
// No @/ imports — also used by tsx scripts.

import type { HoldingIdentity } from "./holding-identities";
import { buildShareClasses, latestCapital, totalOutstandingShares, type CapitalSnapshot } from "./holding-share-classes";
import { computeHoldingIndicators } from "./holding-indicators";
import { portfolioFreshness } from "./holding-portfolio-validation";
import {
  HOLDING_CACHE_SCHEMA_VERSION,
  type EnrichmentStatus,
  type HoldingCache,
  type HoldingPortfolio,
  type HoldingShareClass,
  type HoldingStatement,
} from "./holding-types";

export type SourceOutcome<T> = { ok: true; value: T } | { ok: false; error: string };

export interface CvmOutcome {
  statements: HoldingStatement[];
  capital: CapitalSnapshot[];
  sources: string[];
}

export interface PortfolioOutcome {
  portfolio: HoldingPortfolio;
  warnings: string[];
}

export interface HoldingRefreshInput {
  identity: HoldingIdentity;
  /** Registry DENOM_SOCIAL; falls back to the previous cache, then the verified name. */
  legalName: string | null;
  previous: HoldingCache | null;
  cvm: SourceOutcome<CvmOutcome>;
  portfolio: SourceOutcome<PortfolioOutcome>;
  updatedAt: string;
}

export interface HoldingRefreshResult {
  cache: HoldingCache | null;
  write: boolean;
  reason: string;
}

export const PORTFOLIO_PRESERVED_WARNING =
  "Fonte oficial do portfólio indisponível — mantido o último retrato validado.";
export const STATEMENTS_PRESERVED_WARNING =
  "Demonstrações CVM indisponíveis — mantido o histórico anterior.";

function mergeStatements(previous: readonly HoldingStatement[], fresh: readonly HoldingStatement[]): HoldingStatement[] {
  const byPeriod = new Map(previous.map(s => [s.periodEnd, s]));
  for (const s of fresh) byPeriod.set(s.periodEnd, s);
  return [...byPeriod.values()].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
}

/** Share counts published with the portfolio vs CVM (diagnostic only). */
function shareCountDiagnostics(portfolio: HoldingPortfolio | null, classes: readonly HoldingShareClass[]): string[] {
  if (!portfolio) return [];
  const out: string[] = [];
  for (const c of portfolio.officialMarketValue.classes) {
    const cvm = c.sharesScope === "all_classes_ex_treasury"
      ? totalOutstandingShares(classes)
      : classes.find(k => k.ticker === c.ticker)?.outstandingShares ?? null;
    if (cvm === null) continue;
    // CVM publishes thousands of shares; the issuer may round to millions.
    const allowance = Math.max(1_000, Math.abs(cvm) * 0.005);
    if (Math.abs(cvm - c.shares) > allowance) {
      out.push(`${c.ticker}: issuer share count ${c.shares} differs from CVM outstanding ${cvm} (${classes[0]?.referenceDate ?? "?"})`);
    }
  }
  return out;
}

/**
 * When 1.01.02 is classified as a portfolio investment, the official snapshot
 * should carry a booked-fair-value line of the same amount at the same
 * balance date (Itaúsa: NTS). A mismatch asks for re-verification; it never
 * moves the amount into cash.
 */
export function shortTermInvestmentDiagnostics(
  latest: HoldingStatement | null,
  portfolio: HoldingPortfolio | null,
): string[] {
  const sti = latest?.shortTermInvestments;
  if (!sti || sti.classification !== "portfolio_investment" || sti.value === 0 || !portfolio) return [];
  const sameDate = portfolio.components.filter(c => c.valueBasis === "booked_fair_value" && c.valueReferenceDate === latest!.periodEnd);
  if (sameDate.length === 0) return [];
  const halfUnit = portfolio.source.publishedUnit === "BRL_millions" ? 500_000 : 500;
  if (sameDate.some(c => Math.abs(c.value - sti.value) <= halfUnit)) return [];
  return [`1.01.02 Aplicações Financeiras (${sti.value}) no longer matches a booked-fair-value portfolio line at ${latest!.periodEnd} — classification must be re-verified`];
}

export function refreshHoldingCache(input: HoldingRefreshInput): HoldingRefreshResult {
  const { identity, previous, cvm, portfolio: pf } = input;
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!cvm.ok && !pf.ok && previous) {
    return { cache: null, write: false, reason: `CVM and portfolio sources failed (${cvm.error}; ${pf.error}) — previous cache kept` };
  }

  let statements: HoldingStatement[];
  let statementsStatus: EnrichmentStatus;
  let shareClasses: HoldingShareClass[];
  let statementSources: string[];
  if (cvm.ok && cvm.value.statements.length > 0) {
    statements = mergeStatements(previous?.statements ?? [], cvm.value.statements);
    statementsStatus = "ok";
    const capital = latestCapital(cvm.value.capital);
    shareClasses = capital ? buildShareClasses(identity, capital) : previous?.shareClasses ?? buildShareClasses(identity, null);
    if (!capital) issues.push("composicao_capital not found in CVM filings");
    statementSources = [...new Set([...(previous?.provenance.statements ?? []), ...cvm.value.sources])].sort();
  } else {
    const error = cvm.ok ? "no parent-only statements extracted" : cvm.error;
    if (!previous) return { cache: null, write: false, reason: `CVM statements unavailable and no previous cache (${error})` };
    statements = previous.statements;
    statementsStatus = "preserved";
    shareClasses = previous.shareClasses;
    statementSources = previous.provenance.statements;
    issues.push(`CVM unavailable (${error}); previous statement history preserved`);
    warnings.push(STATEMENTS_PRESERVED_WARNING);
  }

  let portfolio: HoldingPortfolio | null;
  let portfolioStatus: EnrichmentStatus;
  if (pf.ok) {
    const prev = previous?.portfolio ?? null;
    if (prev && pf.value.portfolio.portfolioReferenceDate < prev.portfolioReferenceDate) {
      portfolio = prev;
      portfolioStatus = "preserved";
      issues.push(`official snapshot ${pf.value.portfolio.portfolioReferenceDate} is older than the cached ${prev.portfolioReferenceDate}; cached snapshot kept`);
      warnings.push(PORTFOLIO_PRESERVED_WARNING);
    } else {
      portfolio = pf.value.portfolio;
      portfolioStatus = "ok";
      warnings.push(...pf.value.warnings);
    }
  } else if (previous?.portfolio) {
    portfolio = previous.portfolio;
    portfolioStatus = "preserved";
    issues.push(`portfolio source failed (${pf.error}); previous validated snapshot preserved`);
    warnings.push(PORTFOLIO_PRESERVED_WARNING);
  } else {
    portfolio = null;
    portfolioStatus = "failed";
    issues.push(`portfolio source failed (${pf.error}); no validated snapshot available`);
    warnings.push("Retrato oficial do portfólio indisponível.");
  }

  const latest = statements[statements.length - 1] ?? null;
  if (latest) warnings.push(...latest.issues.map(i => `${latest.periodEnd}: ${i}`));
  warnings.push(...shareCountDiagnostics(portfolio, shareClasses));
  warnings.push(...shortTermInvestmentDiagnostics(latest, portfolio));
  const freshness = portfolioFreshness(portfolio, latest?.periodEnd ?? null);
  if (freshness.status === "stale") {
    warnings.push(`Retrato do portfólio (${freshness.portfolioReferenceDate}) mais de um trimestre anterior às demonstrações (${freshness.statementReferenceDate}).`);
  }

  const marketPriceReferenceDates: Record<string, string | null> = {};
  for (const c of portfolio?.officialMarketValue.classes ?? []) marketPriceReferenceDates[c.ticker] = portfolio!.officialMarketValue.priceReferenceDate;

  const cache: HoldingCache = {
    schemaVersion: HOLDING_CACHE_SCHEMA_VERSION,
    ticker: identity.canonicalTicker,
    source: "holding_analysis",
    issuer: {
      canonicalTicker: identity.canonicalTicker,
      cvmCode: identity.cvmCode,
      cnpj: identity.cnpj,
      legalName: input.legalName ?? previous?.issuer.legalName ?? identity.legalName,
      statementBasis: "individual",
    },
    shareClasses,
    statements,
    latestStatement: latest
      ? { periodEnd: latest.periodEnd, document: latest.document, filingDate: latest.filingDate, filingVersion: latest.filingVersion }
      : null,
    portfolio,
    portfolioFreshness: freshness,
    indicators: computeHoldingIndicators(statements, portfolio),
    referenceDates: {
      financialStatementReferenceDate: latest?.periodEnd ?? null,
      filingDate: latest?.filingDate ?? null,
      portfolioReferenceDate: portfolio?.portfolioReferenceDate ?? null,
      portfolioPublicationDate: portfolio?.portfolioPublicationDate ?? null,
      shareCountReferenceDate: shareClasses[0]?.referenceDate ?? null,
      marketPriceReferenceDates,
    },
    provenance: { statements: statementSources, portfolio: portfolio?.source.url ?? null },
    enrichment: { statements: statementsStatus, portfolio: portfolioStatus, issues },
    warnings,
    updatedAt: input.updatedAt,
  };
  return { cache, write: true, reason: `statements ${statementsStatus}, portfolio ${portfolioStatus}` };
}
