// Static list of holding issuers with a committed holding cache (canonical
// tickers). Update after running npm run holding:precompute.
//
// Every share class of a registered issuer (ITSA3/ITSA4, BRAP3/BRAP4) routes to
// the holding model (coverage/model-routing.ts) and reads the issuer cache;
// quotes stay ticker-specific. Client-safe: no fs access.
//
// No @/ imports — also used by tsx scripts.

import { resolveHoldingCacheTicker } from "./holding-identities";

const CACHED_TICKERS = new Set<string>([
  "BRAP4",
  "ITSA4",
]);

/** Issuers (canonical caches) covered by the holding model. */
export const HOLDING_CACHE_COUNT = CACHED_TICKERS.size;

export const HOLDING_BADGE = {
  label: "Modelo de Holding",
  bg:    "#ecfeff",
  color: "#0e7490",
} as const;

/** True for any share class whose issuer has a holding cache. */
export function hasHoldingAnalysisCache(ticker: string): boolean {
  const canonical = resolveHoldingCacheTicker(ticker);
  return canonical !== null && CACHED_TICKERS.has(canonical);
}

export function getHoldingCoverageReason(ticker: string): string {
  return hasHoldingAnalysisCache(ticker)
    ? "Modelo de holdings disponível — portfólio oficial da companhia, demonstrações individuais (CVM) e desconto oficial publicado."
    : "Modelo de holdings sem dados processados para este ativo.";
}

export function getHoldingCoverageLabel(ticker: string): string {
  return hasHoldingAnalysisCache(ticker) ? HOLDING_BADGE.label : "Modelo específico";
}
