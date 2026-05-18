// Static list of FII tickers that have a precomputed FII analysis cache.
// Update this set after running npm run fii:precompute.

const CACHED_TICKERS = new Set([
  "MXRF11",
  "XPML11",
  "HGLG11",
  "KNRI11",
  "VISC11",
  "IRDM11",
  "KNCR11",
  "HGRE11",
]);

export const FII_CACHE_COUNT = CACHED_TICKERS.size;

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
