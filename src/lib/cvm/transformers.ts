import type { NormalizedFinancials } from "./types";
import type { FinancialYear, CompanyFundamentals } from "@/data/companies/types";

export function cvmFinancialsToDashboardFinancials(
  financials: NormalizedFinancials[],
): FinancialYear[] {
  return [...financials]
    .sort((a, b) => a.fiscalYear - b.fiscalYear)
    .map(f => ({
      year:    String(f.fiscalYear),
      receita: f.revenue      ?? 0,
      ebitda:  f.ebit         ?? 0,  // ebit as proxy — EBITDA not in normalized data
      fcl:     f.freeCashFlow ?? 0,
    }));
}

export function buildCvmFundamentalsFromFinancials(
  financials: NormalizedFinancials[],
  fallback: CompanyFundamentals,
): CompanyFundamentals {
  const latest = [...financials].sort((a, b) => b.fiscalYear - a.fiscalYear)[0];
  if (!latest) return fallback;

  return {
    currentRevenue:    latest.revenue  ?? fallback.currentRevenue,
    sharesOutstanding: fallback.sharesOutstanding,
    netDebt:           latest.netDebt  ?? fallback.netDebt,
  };
}
