import { describe, it, expect } from "vitest";
import { computeInsuranceIndicators } from "./insurance-indicators";
import type { InsuranceFinancialRecord } from "./insurance-types";

function rec(
  fiscalYear: number,
  totalAssets: number | null,
  equity: number | null,
  netIncome: number | null,
  premiums?: number | null,
  claims?: number | null,
): InsuranceFinancialRecord {
  return {
    ticker: "TEST3",
    fiscalYear,
    periodEndDate: `${fiscalYear}-12-31`,
    totalAssets,
    equity,
    netIncome,
    ...(premiums !== undefined ? { insurancePremiums: premiums } : {}),
    ...(claims   !== undefined ? { claimsExpense:    claims   } : {}),
    source: "cvm_dfp_insurance",
  };
}

describe("computeInsuranceIndicators", () => {
  it("returns null for empty records", () => {
    expect(computeInsuranceIndicators([])).toBeNull();
  });

  it("returns non-null for single record", () => {
    const result = computeInsuranceIndicators([rec(2024, 100, 20, 5)]);
    expect(result).not.toBeNull();
  });

  it("uses netIncome/equity ROE when single record (no prior year)", () => {
    const result = computeInsuranceIndicators([rec(2024, 100, 20, 5)]);
    expect(result?.roe).toBeCloseTo(5 / 20);
  });

  it("uses avgEquity for ROE when 2+ records", () => {
    const records = [
      rec(2023, 100, 18, 4),
      rec(2024, 110, 22, 6),
    ];
    const result = computeInsuranceIndicators(records);
    const avgEq = (18 + 22) / 2;
    expect(result?.roe).toBeCloseTo(6 / avgEq);
  });

  it("uses avgTotalAssets for ROA when 2+ records", () => {
    const records = [
      rec(2023, 100, 18, 4),
      rec(2024, 120, 22, 6),
    ];
    const result = computeInsuranceIndicators(records);
    const avgA = (100 + 120) / 2;
    expect(result?.roa).toBeCloseTo(6 / avgA);
  });

  it("computes equityToAssets from latest year", () => {
    const records = [
      rec(2023, 100, 15, 3),
      rec(2024, 120, 20, 5),
    ];
    const result = computeInsuranceIndicators(records);
    expect(result?.equityToAssets).toBeCloseTo(20 / 120);
  });

  it("computes netIncomeGrowthYoY correctly", () => {
    const records = [rec(2023, 100, 20, 4), rec(2024, 110, 22, 6)];
    const result = computeInsuranceIndicators(records);
    expect(result?.netIncomeGrowthYoY).toBeCloseTo((6 - 4) / 4);
  });

  it("computes assetGrowthYoY correctly", () => {
    const records = [rec(2023, 100, 20, 4), rec(2024, 120, 22, 5)];
    const result = computeInsuranceIndicators(records);
    expect(result?.assetGrowthYoY).toBeCloseTo((120 - 100) / 100);
  });

  it("returns null ROE when equity is null", () => {
    const result = computeInsuranceIndicators([rec(2024, 100, null, 5)]);
    expect(result?.roe).toBeNull();
  });

  it("returns null ROA when totalAssets is null", () => {
    const result = computeInsuranceIndicators([rec(2024, null, 20, 5)]);
    expect(result?.roa).toBeNull();
  });

  it("returns null ROE when equity is zero", () => {
    const result = computeInsuranceIndicators([rec(2024, 100, 0, 5)]);
    expect(result?.roe).toBeNull();
  });

  it("returns null growth when prior year value is zero", () => {
    const records = [rec(2023, 0, 20, 0), rec(2024, 110, 22, 5)];
    const result = computeInsuranceIndicators(records);
    expect(result?.netIncomeGrowthYoY).toBeNull();
    expect(result?.assetGrowthYoY).toBeNull();
  });

  it("returns null growth when prior year values are null", () => {
    const records = [rec(2023, null, null, null), rec(2024, 110, 22, 5)];
    const result = computeInsuranceIndicators(records);
    expect(result?.netIncomeGrowthYoY).toBeNull();
    expect(result?.assetGrowthYoY).toBeNull();
  });

  it("computes claimsRatio when both premiums and claims are present", () => {
    const records = [rec(2024, 100, 20, 5, 50, 35)];
    const result = computeInsuranceIndicators(records);
    expect(result?.claimsRatio).toBeCloseTo(35 / 50);
  });

  it("returns undefined claimsRatio when premiums are absent", () => {
    const records = [rec(2024, 100, 20, 5)];
    const result = computeInsuranceIndicators(records);
    expect(result?.claimsRatio).toBeUndefined();
  });

  it("returns null claimsRatio when premiums are zero", () => {
    const records = [rec(2024, 100, 20, 5, 0, 10)];
    const result = computeInsuranceIndicators(records);
    expect(result?.claimsRatio).toBeNull();
  });

  it("returns null claimsRatio when premiums are null", () => {
    const records = [rec(2024, 100, 20, 5, null, 10)];
    const result = computeInsuranceIndicators(records);
    expect(result?.claimsRatio).toBeNull();
  });

  it("sorts records by fiscalYear before computing latest", () => {
    const records = [
      rec(2024, 120, 22, 6),
      rec(2022, 90,  15, 3),
      rec(2023, 100, 18, 4),
    ];
    const result = computeInsuranceIndicators(records);
    // latest should be 2024
    expect(result?.equityToAssets).toBeCloseTo(22 / 120);
  });
});
