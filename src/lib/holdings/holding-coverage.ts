// Static list of holding issuers with a committed holding cache (canonical
// tickers). Update after running npm run holding:precompute.
//
// Phase 1: used by the audit only. The dashboard does not route to a holding
// model yet — every holding ticker stays on its pre-model route
// (sector_specific_pending / quote_only), see coverage/model-routing.ts.
//
// No @/ imports — also used by tsx scripts.

import { resolveHoldingCacheTicker } from "./holding-identities";

const CACHED_TICKERS = new Set<string>([
  "BRAP4",
  "ITSA4",
]);

export const HOLDING_CACHE_COUNT = CACHED_TICKERS.size;

/** True for any share class whose issuer has a holding cache. */
export function hasHoldingAnalysisCache(ticker: string): boolean {
  const canonical = resolveHoldingCacheTicker(ticker);
  return canonical !== null && CACHED_TICKERS.has(canonical);
}
