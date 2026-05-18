import type { InsuranceFinancialRecord, InsuranceIndicators } from "./insurance-types";

function safeDiv(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return numerator / denominator;
}

function growthRate(
  current: number | null | undefined,
  prior: number | null | undefined,
): number | null {
  if (current == null || prior == null || prior === 0) return null;
  return (current - prior) / Math.abs(prior);
}

function avg(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null) return null;
  return (a + b) / 2;
}

export function computeInsuranceIndicators(
  annual: InsuranceFinancialRecord[],
): InsuranceIndicators | null {
  if (annual.length === 0) return null;

  const sorted = [...annual].sort((a, b) => a.fiscalYear - b.fiscalYear);
  const latest = sorted[sorted.length - 1];
  const prior  = sorted.length >= 2 ? sorted[sorted.length - 2] : null;

  const avgEquity = prior ? avg(latest.equity, prior.equity) : null;
  const avgAssets = prior ? avg(latest.totalAssets, prior.totalAssets) : null;

  const roe = safeDiv(latest.netIncome, avgEquity ?? latest.equity);
  const roa = safeDiv(latest.netIncome, avgAssets ?? latest.totalAssets);
  const equityToAssets = safeDiv(latest.equity, latest.totalAssets);

  const netIncomeGrowthYoY = growthRate(latest.netIncome, prior?.netIncome);
  const assetGrowthYoY     = growthRate(latest.totalAssets, prior?.totalAssets);

  const hasClaims   = latest.claimsExpense   != null;
  const hasPremiums = latest.insurancePremiums != null;
  const claimsRatio =
    hasClaims || hasPremiums
      ? safeDiv(latest.claimsExpense, latest.insurancePremiums)
      : undefined;

  return {
    roe,
    roa,
    equityToAssets,
    netIncomeGrowthYoY,
    assetGrowthYoY,
    ...(claimsRatio !== undefined ? { claimsRatio } : {}),
  };
}
