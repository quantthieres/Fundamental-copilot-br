// Shareholder cash returns and share counts.
//
// Distributions ("Pagamento de Proventos": dividends + interest on equity
// paid) and buybacks ("Recompra de Ações") come from the consolidated
// cash-flow statement, matched by verified description because their codes
// drift (6.03.01–6.03.08). TTM uses non-overlapping cumulative periods
// (computeTtm); amounts are reported as positive cash returned.
//
// Share counts come from CVM composicao_capital (units for B3). The 12-month
// change compares the latest count with the same quarter-end one year
// earlier; an issued-share jump (e.g. the 2021 3-for-1 split) makes the
// interval non-comparable → null.
//
// Descriptive only — never interpreted as a recommendation.
//
// No @/ imports — also used by tsx scripts.

import type { CapitalAllocation, MarketInfrastructureStatement, ShareCountSnapshot } from "./market-infrastructure-types";
import { computeTtm, oneYearEarlier } from "./market-infrastructure-statements";

/** Highest version per reference date, sorted by date. */
export function normalizeShareCounts(entries: readonly ShareCountSnapshot[]): ShareCountSnapshot[] {
  const best = new Map<string, ShareCountSnapshot>();
  for (const e of entries) {
    const prev = best.get(e.referenceDate);
    if (!prev || e.filingVersion > prev.filingVersion) best.set(e.referenceDate, e);
  }
  return [...best.values()].sort((a, b) => a.referenceDate.localeCompare(b.referenceDate));
}

/** issued(end) / issued(start) outside this band ⇒ split/reverse split; change not comparable. */
const SPLIT_BAND = { min: 0.67, max: 1.5 };

export interface OutstandingSharesChange {
  latest: ShareCountSnapshot | null;
  comparable: ShareCountSnapshot | null;
  change: number | null;
  changeRatio: number | null;
  reason?: string;
}

export function outstandingSharesChange(counts: readonly ShareCountSnapshot[]): OutstandingSharesChange {
  const latest = counts[counts.length - 1] ?? null;
  if (!latest) return { latest: null, comparable: null, change: null, changeRatio: null, reason: "no share counts" };
  const comparable = counts.find(c => c.referenceDate === oneYearEarlier(latest.referenceDate)) ?? null;
  if (!comparable) return { latest, comparable: null, change: null, changeRatio: null, reason: `no share count at ${oneYearEarlier(latest.referenceDate)}` };
  const issuedRatio = latest.issuedShares / comparable.issuedShares;
  if (issuedRatio < SPLIT_BAND.min || issuedRatio > SPLIT_BAND.max) {
    return { latest, comparable, change: null, changeRatio: null, reason: `issued shares ${comparable.issuedShares} → ${latest.issuedShares}: split or reverse split, not comparable` };
  }
  const change = latest.outstandingShares - comparable.outstandingShares;
  return { latest, comparable, change, changeRatio: Math.round((change / comparable.outstandingShares) * 1e6) / 1e6 };
}

const positive = (v: number | null) => (v === null ? null : -v);

export function buildCapitalAllocation(
  statements: readonly MarketInfrastructureStatement[],
  counts: readonly ShareCountSnapshot[],
): CapitalAllocation {
  const latest = statements[statements.length - 1] ?? null;
  const issues: string[] = [];
  if (!latest) return { referencePeriod: [], distributionsPaidTtm: null, buybacksTtm: null, latestShareCount: null, comparableShareCount: null, issues: ["no statements"] };
  const distributions = computeTtm(statements, latest.periodEnd, "distributionsPaidYtd");
  const buybacks = computeTtm(statements, latest.periodEnd, "buybacksYtd");
  if (distributions.value === null) issues.push(`distributions TTM unavailable (${distributions.reason})`);
  if (buybacks.value === null) issues.push(`buybacks TTM unavailable (${buybacks.reason})`);
  const shares = outstandingSharesChange(counts);
  if (shares.change === null && shares.reason) issues.push(`outstanding-share change unavailable (${shares.reason})`);
  return {
    referencePeriod: distributions.composition.length ? distributions.composition : buybacks.composition,
    distributionsPaidTtm: positive(distributions.value),
    buybacksTtm: positive(buybacks.value),
    latestShareCount: shares.latest,
    comparableShareCount: shares.comparable,
    issues,
  };
}
