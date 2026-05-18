// Static list of bank tickers that have a precomputed bank analysis cache.
// Update this set after running npm run bank:precompute.

const CACHED_TICKERS = new Set([
  "BBAS3",
  "BBDC4",
  "BPAC11",
  "BRSR6",
  "ITUB4",
  "SANB11",
]);

export const BANK_CACHE_COUNT = CACHED_TICKERS.size;

export const BANK_BADGE = {
  label: "Modelo bancário",
  bg:    "#d1fae5",
  color: "#065f46",
} as const;

export function hasBankAnalysisCache(ticker: string): boolean {
  return CACHED_TICKERS.has(ticker.toUpperCase());
}

export function getBankCoverageReason(ticker: string): string {
  return hasBankAnalysisCache(ticker)
    ? "Análise bancária anual com indicadores de instituições financeiras, baseada em dados CVM."
    : "Modelo específico para instituições financeiras em desenvolvimento.";
}

export function getBankCoverageLabel(ticker: string): string {
  return hasBankAnalysisCache(ticker) ? "Modelo bancário" : "Modelo específico";
}
