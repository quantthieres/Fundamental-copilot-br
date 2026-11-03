// Usable annual observations in a precomputed CVM financials cache.
//
// Shared by every audit that reports "years of data" (report:audit,
// coverage:audit:readiness) so they can never disagree. A year counts when
// its row has an integer fiscalYear and at least one finite numeric field.
//
// No @/ imports — also used by tsx scripts.

const NUMERIC_FIELDS = [
  "revenue", "ebit", "netIncome", "operatingCashFlow", "capex",
  "freeCashFlow", "cash", "totalDebt", "netDebt",
] as const;

export function countUsableAnnualYears(rows: readonly unknown[] | null | undefined): number {
  if (!Array.isArray(rows)) return 0;
  const years = new Set<number>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.fiscalYear !== "number" || !Number.isInteger(r.fiscalYear)) continue;
    if (NUMERIC_FIELDS.some(f => typeof r[f] === "number" && Number.isFinite(r[f] as number))) years.add(r.fiscalYear);
  }
  return years.size;
}
