// Closed-fiscal-year window for annual DFP ingestion.
//
// Default: 2020 .. (current calendar year − 1), e.g. 2020–2025 during 2026.
// Early in the year the latest DFP ZIP may not exist yet; the fetchers skip
// unavailable years, so the window can safely include it.
//
// Optional overrides (integers only, start <= end):
//   CVM_DFP_START_YEAR  (default 2020)
//   CVM_DFP_END_YEAR    (default current year − 1)
//
// No @/ imports — also used by tsx scripts.

export const DFP_DEFAULT_START_YEAR = 2020;

/** CVM open data DFP files start in 2010. */
export const DFP_MIN_YEAR = 2010;

type Env = Record<string, string | undefined>;

function parseYearOverride(name: string, raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const value = raw.trim();
  if (!/^\d{4}$/.test(value)) {
    throw new Error(`${name} must be a 4-digit year, got "${raw}"`);
  }
  return Number(value);
}

/**
 * Returns the ascending list of DFP fiscal years to ingest.
 * Throws on malformed or out-of-range overrides (fails closed rather than
 * silently ingesting a different window).
 */
export function getDfpYears(now: Date = new Date(), env: Env = process.env): number[] {
  const currentYear = now.getUTCFullYear();
  const start = parseYearOverride("CVM_DFP_START_YEAR", env.CVM_DFP_START_YEAR) ?? DFP_DEFAULT_START_YEAR;
  const end = parseYearOverride("CVM_DFP_END_YEAR", env.CVM_DFP_END_YEAR) ?? currentYear - 1;

  if (start < DFP_MIN_YEAR) {
    throw new Error(`CVM_DFP_START_YEAR must be >= ${DFP_MIN_YEAR}, got ${start}`);
  }
  if (end > currentYear) {
    throw new Error(`CVM_DFP_END_YEAR must be <= ${currentYear}, got ${end}`);
  }
  if (start > end) {
    throw new Error(`DFP year range is empty: start ${start} > end ${end}`);
  }

  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
