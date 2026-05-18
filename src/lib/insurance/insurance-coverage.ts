// Static list of insurance tickers that have a precomputed insurance analysis cache.
// Update this set after running npm run insurance:precompute.

const CACHED_TICKERS = new Set<string>([
  "BBSE3",
  "CXSE3",
  "IRBR3",
  "PSSA3",
]);

export const INSURANCE_CACHE_COUNT = CACHED_TICKERS.size;

export const INSURANCE_BADGE = {
  label: "Modelo de Seguradora",
  bg:    "#fff7ed",
  color: "#c2410c",
} as const;

export function hasInsuranceAnalysisCache(ticker: string): boolean {
  return CACHED_TICKERS.has(ticker.toUpperCase());
}

export function getInsuranceCoverageReason(ticker: string): string {
  return hasInsuranceAnalysisCache(ticker)
    ? "Modelo de seguradora disponível — indicadores anuais baseados na DFP CVM."
    : "Modelo específico para seguradoras em desenvolvimento.";
}

export function getInsuranceCoverageLabel(ticker: string): string {
  return hasInsuranceAnalysisCache(ticker) ? "Modelo de Seguradora" : "Modelo específico";
}
