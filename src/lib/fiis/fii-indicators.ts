import type { FiiAnalysisResponse, FiiFinancialRecord, FiiIndicators } from "./fii-types";

// NAV and distributions have different sources and freshness: the newest
// record may be a Fundos.Net-only month with no NAV. Never read NAV fields
// from "the last record" — use the helpers below.

function safeDiv(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return numerator / denominator;
}

function byDateAsc(records: readonly FiiFinancialRecord[]): FiiFinancialRecord[] {
  return [...records].sort((a, b) =>
    a.referenceDate < b.referenceDate ? -1 : a.referenceDate > b.referenceDate ? 1 : 0,
  );
}

function latestWhere(
  records: readonly FiiFinancialRecord[],
  keep: (r: FiiFinancialRecord) => boolean,
): FiiFinancialRecord | null {
  const sorted = byDateAsc(records);
  for (let i = sorted.length - 1; i >= 0; i--) if (keep(sorted[i])) return sorted[i];
  return null;
}

/** Latest record with NAV per share (CVM informe). */
export function latestRecordWithNav(records: readonly FiiFinancialRecord[]): FiiFinancialRecord | null {
  return latestWhere(records, r => r.netAssetValuePerShare != null);
}

/** Latest record with a quota count (CVM informe). */
export function latestRecordWithQuotaCount(records: readonly FiiFinancialRecord[]): FiiFinancialRecord | null {
  return latestWhere(records, r => r.quotaCount != null);
}

/** Latest reference month (yyyy-mm) with a distribution value, 0 included. */
export function latestDistributionReferenceMonth(records: readonly FiiFinancialRecord[]): string | null {
  return latestWhere(records, r => r.monthlyDistributionPerShare != null)?.referenceDate.slice(0, 7) ?? null;
}

function addMonths(month: string, n: number): string {
  const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

function monthsBetween(from: string, to: string): number {
  return (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7));
}

export const DISTRIBUTION_WINDOW_MONTHS = 12;

// The latest distribution reference month may trail the latest NAV reference
// month by at most this many calendar months (a distribution newer than NAV is
// fine). Compares the two sources' reference months — never the wall clock.
// NAV 2026-10 / dist 2026-09 → fresh; NAV 2026-11 / dist 2026-09 → stale.
export const FII_MAX_DISTRIBUTION_LAG_MONTHS = 1;

/**
 * Latest NAV month minus latest distribution month, in calendar months
 * (negative when distributions are newer). null when either is missing.
 */
export function distributionLagMonths(records: readonly FiiFinancialRecord[]): number | null {
  const dist = latestDistributionReferenceMonth(records);
  const nav = latestRecordWithNav(records)?.referenceDate.slice(0, 7) ?? null;
  return dist && nav ? monthsBetween(dist, nav) : null;
}

export function isDistributionFresh(lagMonths: number | null): boolean {
  return lagMonths !== null && lagMonths <= FII_MAX_DISTRIBUTION_LAG_MONTHS;
}

/**
 * The 12 consecutive calendar months (yyyy-mm, oldest first) ending at the
 * latest distribution reference month; at the latest NAV month when there is
 * no distribution at all. Empty with no data.
 */
export function distributionWindowMonths(records: readonly FiiFinancialRecord[]): string[] {
  const end = latestDistributionReferenceMonth(records)
    ?? latestRecordWithNav(records)?.referenceDate.slice(0, 7)
    ?? null;
  if (!end) return [];
  return Array.from({ length: DISTRIBUTION_WINDOW_MONTHS }, (_, i) => addMonths(end, i - DISTRIBUTION_WINDOW_MONTHS + 1));
}

/**
 * Indicators for display (dashboard panel and report). The cache stores
 * `indicators: null` on purpose — they depend on the market price — so this
 * always computes them from the records and the quote.
 */
export function fiiDisplayIndicators(
  data: Pick<FiiAnalysisResponse, "records">,
  marketPrice: number | null,
): FiiIndicators | null {
  return computeFiiIndicators(data.records, marketPrice);
}

/** Source line for FII panels: Fundos.Net is named only when it supplied a month. */
export function fiiSourceLabel(records: readonly FiiFinancialRecord[]): string {
  return records.some(r => r.distributionSource === "fnet_structured")
    ? "CVM Informe Mensal · Rendimentos: B3 Fundos.Net"
    : "CVM Informe Mensal";
}

export function computeFiiIndicators(
  records: FiiFinancialRecord[],
  marketPrice: number | null,
): FiiIndicators | null {
  if (records.length === 0) return null;

  const navRecord   = latestRecordWithNav(records);
  const navPerShare = navRecord?.netAssetValuePerShare ?? null;

  const byMonth = new Map(records.map(r => [r.referenceDate.slice(0, 7), r]));
  const window  = distributionWindowMonths(records);
  const distValues = window
    .map(m => byMonth.get(m)?.monthlyDistributionPerShare ?? null)
    .filter((v): v is number => v !== null);
  const coverageMonths = distValues.length;

  const distMonth = latestDistributionReferenceMonth(records);
  const lagMonths = distributionLagMonths(records);
  const lastDist  = distMonth ? byMonth.get(distMonth)?.monthlyDistributionPerShare ?? null : null;

  // Require at least 6 non-null months to compute 12m distribution sum.
  // Fewer than 6 valid months means the series is too sparse to be meaningful.
  const twelveMonthDist = coverageMonths >= 6
    ? distValues.reduce((a, b) => a + b, 0)
    : null;

  const dividendYield12m       = safeDiv(twelveMonthDist, marketPrice);
  const priceToBookValuePerShare = safeDiv(marketPrice, navPerShare);

  return {
    netAssetValuePerShare:          navPerShare,
    lastDistributionPerShare:       lastDist,
    twelveMonthDistributionPerShare: twelveMonthDist,
    dividendYield12m,
    priceToBookValuePerShare,
    distributionCoverageMonths:     coverageMonths,
    navReferenceDate:               navRecord?.referenceDate ?? null,
    distributionReferenceDate:      distMonth ? `${distMonth}-01` : null,
    distributionWindowEnd:          window.length ? `${window[window.length - 1]}-01` : null,
    distributionLagMonths:          lagMonths,
    distributionFresh:              isDistributionFresh(lagMonths),
  };
}
