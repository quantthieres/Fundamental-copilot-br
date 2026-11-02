export function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals).replace(".", ",")}%`;
}

export function formatMultiple(value: number, decimals = 1): string {
  return `${value.toFixed(decimals).replace(".", ",")}x`;
}

export function formatNumberBR(value: number, decimals = 2): string {
  return value.toFixed(decimals).replace(".", ",");
}

/**
 * "AF2020–AF2025" range label from the fiscal years actually rendered
 * (order-independent). Non-numeric labels are ignored; null when none remain.
 */
export function formatFiscalYearRange(years: readonly string[]): string | null {
  const numeric = years
    .map(y => y.trim())
    .filter(y => /^\d{4}$/.test(y))
    .map(Number);
  if (numeric.length === 0) return null;
  const first = Math.min(...numeric);
  const last = Math.max(...numeric);
  return first === last ? `AF${first}` : `AF${first}–AF${last}`;
}
