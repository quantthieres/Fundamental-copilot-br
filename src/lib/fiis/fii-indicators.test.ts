import { describe, it, expect } from "vitest";
import { computeFiiIndicators } from "./fii-indicators";
import type { FiiFinancialRecord } from "./fii-types";

function rec(
  referenceDate: string,
  navPerShare: number | null,
  nav: number | null,
  dist: number | null,
): FiiFinancialRecord {
  return {
    ticker: "TEST11",
    referenceDate,
    netAssetValue: nav,
    quotaCount: nav !== null && navPerShare !== null && navPerShare !== 0
      ? nav / navPerShare
      : null,
    netAssetValuePerShare: navPerShare,
    monthlyDistributionPerShare: dist,
    source: "fii_cvm_cache",
  };
}

describe("computeFiiIndicators", () => {
  it("returns null for empty records", () => {
    expect(computeFiiIndicators([], null)).toBeNull();
    expect(computeFiiIndicators([], 120)).toBeNull();
  });

  it("returns navPerShare from latest record", () => {
    const records = [
      rec("2024-11-30", 100, 1_000_000, 0.8),
      rec("2024-12-31", 105, 1_050_000, 0.85),
    ];
    const result = computeFiiIndicators(records, null);
    expect(result?.netAssetValuePerShare).toBe(105);
  });

  it("returns lastDistributionPerShare from latest record", () => {
    const records = [
      rec("2024-11-30", 100, 1_000_000, 0.8),
      rec("2024-12-31", 105, 1_050_000, 0.9),
    ];
    const result = computeFiiIndicators(records, null);
    expect(result?.lastDistributionPerShare).toBe(0.9);
  });

  it("sums last 12 monthly distributions", () => {
    const records = Array.from({ length: 14 }, (_, i) =>
      rec(`2024-${String(i + 1).padStart(2, "0")}-28`, 100, 1_000_000, 1.0),
    );
    const result = computeFiiIndicators(records, null);
    // Should sum only last 12 records (12 × 1.0 = 12.0), not all 14
    expect(result?.twelveMonthDistributionPerShare).toBeCloseTo(12.0);
  });

  it("returns null for twelveMonthDist when all distributions are null", () => {
    const records = [
      rec("2024-11-30", 100, null, null),
      rec("2024-12-31", 100, null, null),
    ];
    const result = computeFiiIndicators(records, null);
    expect(result?.twelveMonthDistributionPerShare).toBeNull();
  });

  it("sums only non-null distribution values (partial coverage)", () => {
    const records = [
      rec("2024-10-31", 100, null, 1.0),
      rec("2024-11-30", 100, null, null),
      rec("2024-12-31", 100, null, 1.5),
    ];
    const result = computeFiiIndicators(records, null);
    expect(result?.twelveMonthDistributionPerShare).toBeCloseTo(2.5);
  });

  it("returns null for market-dependent indicators when marketPrice is null", () => {
    const records = [rec("2024-12-31", 100, 1_000_000, 1.0)];
    const result = computeFiiIndicators(records, null);
    expect(result?.dividendYield12m).toBeNull();
    expect(result?.priceToBookValuePerShare).toBeNull();
  });

  it("computes dividendYield12m correctly", () => {
    const records = Array.from({ length: 12 }, (_, i) =>
      rec(`2024-${String(i + 1).padStart(2, "0")}-28`, 100, null, 1.0),
    );
    const result = computeFiiIndicators(records, 120);
    // 12 / 120 = 0.1 = 10%
    expect(result?.dividendYield12m).toBeCloseTo(0.1);
  });

  it("computes priceToBookValuePerShare correctly", () => {
    const records = [rec("2024-12-31", 100, null, null)];
    const result = computeFiiIndicators(records, 110);
    // 110 / 100 = 1.1
    expect(result?.priceToBookValuePerShare).toBeCloseTo(1.1);
  });

  it("returns null for dividendYield12m when marketPrice is zero", () => {
    const records = Array.from({ length: 12 }, (_, i) =>
      rec(`2024-${String(i + 1).padStart(2, "0")}-28`, 100, null, 1.0),
    );
    const result = computeFiiIndicators(records, 0);
    expect(result?.dividendYield12m).toBeNull();
  });

  it("returns null for priceToBookValuePerShare when navPerShare is zero", () => {
    const records = [rec("2024-12-31", 0, null, null)];
    const result = computeFiiIndicators(records, 110);
    expect(result?.priceToBookValuePerShare).toBeNull();
  });

  it("sorts records by referenceDate before computing latest", () => {
    const records = [
      rec("2024-12-31", 105, null, 0.9),
      rec("2024-06-30", 95, null, 0.7),
      rec("2024-11-30", 102, null, 0.8),
    ];
    const result = computeFiiIndicators(records, null);
    // Latest is 2024-12-31
    expect(result?.netAssetValuePerShare).toBe(105);
    expect(result?.lastDistributionPerShare).toBe(0.9);
  });

  it("handles single record without crashing", () => {
    const records = [rec("2024-12-31", 98.5, 1_000_000, 0.75)];
    const result = computeFiiIndicators(records, 105);
    expect(result?.netAssetValuePerShare).toBe(98.5);
    expect(result?.twelveMonthDistributionPerShare).toBeCloseTo(0.75);
    expect(result?.priceToBookValuePerShare).toBeCloseTo(105 / 98.5);
  });
});
