import type { FiiFinancialRecord, FiiIndicators } from "./fii-types";

function safeDiv(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return numerator / denominator;
}

export function computeFiiIndicators(
  records: FiiFinancialRecord[],
  marketPrice: number | null,
): FiiIndicators | null {
  if (records.length === 0) return null;

  const sorted = [...records].sort((a, b) =>
    a.referenceDate < b.referenceDate ? -1 : a.referenceDate > b.referenceDate ? 1 : 0,
  );
  const latest = sorted[sorted.length - 1];

  const navPerShare = latest.netAssetValuePerShare ?? null;
  const lastDist    = latest.monthlyDistributionPerShare ?? null;

  // Sum the last 12 monthly distribution values (nulls excluded from sum only
  // if at least one non-null value exists; if all null, result is null).
  const last12 = sorted.slice(-12);
  const distValues = last12
    .map(r => r.monthlyDistributionPerShare ?? null)
    .filter((v): v is number => v !== null);
  const twelveMonthDist = distValues.length > 0
    ? distValues.reduce((a, b) => a + b, 0)
    : null;

  const dividendYield12m       = safeDiv(twelveMonthDist, marketPrice);
  const priceToBookValuePerShare = safeDiv(marketPrice, navPerShare);

  return {
    netAssetValuePerShare:          navPerShare,
    lastDistributionPerShare:       lastDist,
    twelveMonthDistributionPerShare: twelveMonthDist,
    dividendYield12m,
    priceToBookValuePerShare,
  };
}
