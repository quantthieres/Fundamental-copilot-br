// Static list of FII tickers that have a precomputed FII analysis cache.
// Update this set after running npm run fii:precompute.
//
// Historical codes (e.g. IRDM11) keep their available:true cache registered so
// the set mirrors the files on disk, but route as "unavailable" and are left
// out of FII_CACHE_COUNT, which counts current coverage.

import { getTickerLifecycle } from "../coverage/ticker-lifecycle";

const CACHED_TICKERS = new Set([
  "MXRF11",
  "XPML11",
  "HGLG11",
  "KNRI11",
  "VISC11",
  "IRDM11",
  "KNCR11",
  "HGRE11",
  "BTHF11",
  "IRIM11",
]);

export const FII_CACHE_COUNT = [...CACHED_TICKERS].filter(t => !getTickerLifecycle(t)).length;

export const FII_BADGE = {
  label: "Modelo de FII",
  bg:    "#ede9fe",
  color: "#6d28d9",
} as const;

export function hasFiiAnalysisCache(ticker: string): boolean {
  return CACHED_TICKERS.has(ticker.toUpperCase());
}

export function getFiiCoverageReason(ticker: string): string {
  return hasFiiAnalysisCache(ticker)
    ? "Modelo de fundos imobiliários disponível — indicadores mensais baseados no informe mensal CVM."
    : "Modelo específico para fundos imobiliários em desenvolvimento.";
}

export function getFiiCoverageLabel(ticker: string): string {
  return hasFiiAnalysisCache(ticker) ? "Modelo de FII" : "Modelo específico";
}
