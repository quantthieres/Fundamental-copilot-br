// Product readiness of one committed holding cache (rules in docs/holding-model.md).
//
//   ready    — identity verified, latest parent-only statement with every core
//              account, share-class counts, a validated portfolio snapshot that
//              passes the freshness rule, nothing preserved from an earlier run.
//   limited  — usable, but the portfolio is stale/preserved/missing or a
//              nonfatal statement/share-class gap prevents full analysis.
//   unusable — missing/unreadable, wrong schema or identity, or neither a
//              statement nor a portfolio to show.
//
// Pure: the cache comes from holding-cache.ts (server/scripts) or tests.
// Client-safe. No @/ imports — also used by tsx scripts.

import { VERIFIED_HOLDING_IDENTITIES, resolveHoldingCacheTicker } from "./holding-identities";
import { HOLDING_CACHE_SCHEMA_VERSION, type HoldingCache, type HoldingStatement } from "./holding-types";

export type HoldingCacheReadiness = "ready" | "limited" | "unusable";

export interface HoldingCacheAssessment {
  status: HoldingCacheReadiness;
  /** Issuer cache read for this share class (ITSA3 → ITSA4); null when not a holding share class. */
  canonicalTicker: string | null;
  /** Why the cache is limited/unusable (English, audit-facing); empty when ready. */
  reasons: string[];
}

/** Statement fields every holding analysis needs (parent-only, latest period). */
export const REQUIRED_HOLDING_STATEMENT_FIELDS = [
  "cash",
  "grossDebt",
  "equity",
  "equityStakes",
  "equityMethodIncomeYtd",
  "netIncomeYtd",
  "dividendsReceivedYtd",
] as const satisfies readonly (keyof HoldingStatement)[];

export function assessHoldingCache(ticker: string, cache: HoldingCache | null): HoldingCacheAssessment {
  const canonical = resolveHoldingCacheTicker(ticker);
  if (!canonical) return { status: "unusable", canonicalTicker: null, reasons: [`${ticker} is not a covered holding share class`] };
  if (!cache) return { status: "unusable", canonicalTicker: canonical, reasons: [`holding cache ${canonical} missing or unreadable`] };

  const id = VERIFIED_HOLDING_IDENTITIES[canonical];
  const fatal: string[] = [];
  if (cache.schemaVersion !== HOLDING_CACHE_SCHEMA_VERSION) fatal.push(`schema version ${cache.schemaVersion}`);
  if (cache.ticker !== canonical) fatal.push(`cache ticker ${cache.ticker} ≠ ${canonical}`);
  if (cache.issuer?.cvmCode !== id.cvmCode || cache.issuer?.cnpj !== id.cnpj) fatal.push("issuer identity does not match the verified registry");
  if (cache.issuer?.statementBasis !== "individual") fatal.push("statement basis is not individual (parent-only)");
  const latest = cache.statements?.[cache.statements.length - 1] ?? null;
  if (!latest && !cache.portfolio) fatal.push("no statement and no portfolio snapshot");
  if (fatal.length > 0) return { status: "unusable", canonicalTicker: canonical, reasons: fatal };

  const reasons: string[] = [];
  if (!latest || !cache.latestStatement) {
    reasons.push("no parent-only statement");
  } else {
    if (latest.basis !== "individual") reasons.push(`latest statement ${latest.periodEnd} is not parent-only`);
    if (latest.periodEnd !== cache.latestStatement.periodEnd) reasons.push("latestStatement does not match the statement history");
    const missing = REQUIRED_HOLDING_STATEMENT_FIELDS.filter(f => latest[f] === null);
    if (missing.length > 0) reasons.push(`latest statement ${latest.periodEnd} lacks ${missing.join(", ")}`);
  }

  const expectedClasses = id.shareClasses.map(c => c.ticker).join(",");
  if (cache.shareClasses.map(c => c.ticker).join(",") !== expectedClasses) reasons.push(`share classes ≠ ${expectedClasses}`);
  else if (cache.shareClasses.some(c => c.outstandingShares === null)) reasons.push("share-class counts missing");

  if (!cache.portfolio) reasons.push("no portfolio snapshot");
  else if (cache.portfolio.validation.status !== "passed") reasons.push("portfolio arithmetic validation not passed");
  if (cache.portfolio && cache.portfolioFreshness.status !== "fresh") {
    reasons.push(`portfolio ${cache.portfolioFreshness.status} (lag ${cache.portfolioFreshness.quarterLag ?? "?"} quarter(s) behind the latest statement)`);
  }
  if (cache.enrichment.portfolio !== "ok") reasons.push(`portfolio enrichment ${cache.enrichment.portfolio}`);
  if (cache.enrichment.statements !== "ok") reasons.push(`statement enrichment ${cache.enrichment.statements}`);

  return { status: reasons.length === 0 ? "ready" : "limited", canonicalTicker: canonical, reasons };
}
