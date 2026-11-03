// Comparability guard for issuers whose filed history predates their current
// business (READINESS_DECISIONS[t].comparabilityBreak — today only AUAU3).
//
// Historical statements and the current quote stay visible. What is withheld:
//   - market multiples that divide today's market value by pre-break
//     fundamentals, while the latest annual year is still pre-break;
//   - baseline forecasts, until enough post-break quarters exist.
// Both conditions are derived from the cached data, so they lift on their own
// as combined-company filings arrive.
//
// Pure — no fs, no @/ imports (also used by tsx scripts and client components).

import { READINESS_DECISIONS, type ComparabilityBreak } from "./asset-readiness";

/** Post-break quarters required before forecasts are served (= MODEL_MIN_OBS.seasonal_naive / linear_trend). */
export const MIN_COMPARABLE_QUARTERS_FOR_FORECAST = 8;

export function getComparabilityBreak(ticker: string | null | undefined): ComparabilityBreak | null {
  if (!ticker) return null;
  return READINESS_DECISIONS[ticker.toUpperCase()]?.comparabilityBreak ?? null;
}

/**
 * Note explaining why market multiples are withheld, or null when they may be
 * shown: no break, or the latest annual year already reflects the current business.
 */
export function marketMultiplesSuppression(
  ticker: string | null | undefined,
  financials: readonly { fiscalYear: number }[],
): string | null {
  const brk = getComparabilityBreak(ticker);
  if (!brk) return null;
  const latest = financials.reduce<number | null>((m, f) => (m === null || f.fiscalYear > m ? f.fiscalYear : m), null);
  return latest === null || latest <= brk.lastPreBreakFiscalYear ? brk.notePt : null;
}

/** Quarters at or after the break (the only ones describing the current business). */
export function countComparableQuarters(
  ticker: string | null | undefined,
  quarters: readonly { fiscalYear: number; quarter: number }[],
): number | null {
  const brk = getComparabilityBreak(ticker);
  if (!brk) return null;
  const { fiscalYear, quarter } = brk.firstComparableQuarter;
  return quarters.filter(q => q.fiscalYear > fiscalYear || (q.fiscalYear === fiscalYear && q.quarter >= quarter)).length;
}

/** Note explaining why forecasts are withheld, or null when they may be served. */
export function forecastSuppression(
  ticker: string | null | undefined,
  quarters: readonly { fiscalYear: number; quarter: number }[],
): string | null {
  const n = countComparableQuarters(ticker, quarters);
  return n !== null && n < MIN_COMPARABLE_QUARTERS_FOR_FORECAST ? getComparabilityBreak(ticker)!.notePt : null;
}
