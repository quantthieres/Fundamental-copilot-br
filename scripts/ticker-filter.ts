/**
 * Optional ticker filter for precompute scripts.
 *
 * Reads a comma-separated ticker list from the given environment variable
 * (e.g. CVM_PRECOMPUTE_TICKERS=AERI3, recv3 ,SBFG3), normalizes to uppercase
 * and ignores whitespace/empty items.
 *
 * Returns null when the variable is absent or empty — callers must then keep
 * their default (unfiltered) behavior.
 */
export function readTickerFilter(envName: string): Set<string> | null {
  const raw = process.env[envName];
  if (!raw) return null;
  const tickers = raw
    .split(",")
    .map(t => t.trim().toUpperCase())
    .filter(t => t.length > 0);
  if (tickers.length === 0) return null;
  console.log(`[filter] ${envName}: ${tickers.join(", ")}`);
  return new Set(tickers);
}
