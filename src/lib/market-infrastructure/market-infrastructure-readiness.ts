// Phase 1 readiness DIAGNOSTIC of the market-infrastructure cache (audit
// only — routing still sends B3SA3 to quote_only / model_pending).
//
// Freshness is relative between source periods, never against today's date:
//
//   analysis_ready   — identity valid; latest consolidated statement with its
//                      core accounts; financial position classified; latest-
//                      filing segments valid; a workbook KPI snapshot of the
//                      SAME quarter, cross-checked; nothing preserved.
//   analysis_limited — statements usable, but KPIs preserved/stale/failed,
//                      segment taxonomy unrecognised, or the managed financial
//                      position unavailable.
//   cache_pending    — no cache, wrong identity/schema, or no valid
//                      consolidated statement.
//
// Pure. No @/ imports — also used by tsx scripts.

import { getMarketInfrastructureIdentity } from "./market-infrastructure-identity";
import { MARKET_INFRASTRUCTURE_CACHE_SCHEMA_VERSION, type MarketInfrastructureCache, type MarketInfrastructureStatement } from "./market-infrastructure-types";

export type MarketInfrastructureCandidateReadiness = "analysis_ready" | "analysis_limited" | "cache_pending";

export interface MarketInfrastructureAssessment {
  candidate: MarketInfrastructureCandidateReadiness;
  reasons: string[];
}

/** Statement fields the analysis needs at the latest period. */
export const REQUIRED_STATEMENT_FIELDS = [
  "grossRevenueYtd",
  "netRevenueYtd",
  "operatingExpensesYtd",
  "ebitYtd",
  "netIncomeAttributableYtd",
  "depreciationAmortizationYtd",
  "grossDebt",
  "equity",
] as const satisfies readonly (keyof MarketInfrastructureStatement)[];

export function assessMarketInfrastructureCache(ticker: string, cache: MarketInfrastructureCache | null): MarketInfrastructureAssessment {
  const identity = getMarketInfrastructureIdentity(ticker);
  if (!identity) return { candidate: "cache_pending", reasons: [`${ticker} is not a market-infrastructure issuer`] };
  if (!cache) return { candidate: "cache_pending", reasons: ["market-infrastructure cache missing or unreadable"] };

  const fatal: string[] = [];
  if (cache.schemaVersion !== MARKET_INFRASTRUCTURE_CACHE_SCHEMA_VERSION) fatal.push(`schema version ${cache.schemaVersion}`);
  if (cache.ticker !== identity.ticker) fatal.push(`cache ticker ${cache.ticker} ≠ ${identity.ticker}`);
  if (cache.issuer?.cvmCode !== identity.cvmCode || cache.issuer?.cnpj !== identity.cnpj) fatal.push("issuer identity does not match the verified registry");
  if (cache.issuer?.statementBasis !== "consolidated") fatal.push("statement basis is not consolidated");
  const latest = cache.statements?.[cache.statements.length - 1] ?? null;
  if (!latest || latest.basis !== "consolidated") fatal.push("no consolidated statement");
  if (fatal.length > 0) return { candidate: "cache_pending", reasons: fatal };

  const reasons: string[] = [];
  const missing = REQUIRED_STATEMENT_FIELDS.filter(f => latest![f] === null);
  if (missing.length > 0) reasons.push(`latest statement ${latest!.periodEnd} lacks ${missing.join(", ")}`);
  if (cache.enrichment.statements !== "ok") reasons.push(`statement enrichment ${cache.enrichment.statements}`);

  if (cache.financialPosition?.managedNetFinancialPosition == null) reasons.push("managed net financial position unavailable");
  if (cache.enrichment.segments !== "ok") reasons.push(`segment enrichment ${cache.enrichment.segments}`);
  else if (!cache.revenueSegments.some(s => s.source.filingReferenceDate === latest!.periodEnd && !s.source.comparative)) {
    reasons.push(`no validated segment snapshot for ${latest!.periodEnd}`);
  }

  const kpis = cache.operatingMetrics;
  if (!kpis) reasons.push("no validated workbook KPI snapshot");
  else {
    if (kpis.quarterEnd !== latest!.periodEnd) reasons.push(`workbook KPIs ${kpis.quarterLabel} ≠ statement quarter ${latest!.periodEnd}`);
    if (!kpis.revenueCrossCheck.passed) reasons.push("workbook revenue cross-check not passed");
  }
  if (cache.enrichment.operatingMetrics !== "ok") reasons.push(`operating-metrics enrichment ${cache.enrichment.operatingMetrics}`);

  return { candidate: reasons.length === 0 ? "analysis_ready" : "analysis_limited", reasons };
}
