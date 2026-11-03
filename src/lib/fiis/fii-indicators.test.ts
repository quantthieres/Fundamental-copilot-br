import { describe, it, expect } from "vitest";
import {
  FII_MAX_DISTRIBUTION_LAG_MONTHS,
  computeFiiIndicators,
  distributionLagMonths,
  distributionWindowMonths,
  fiiDisplayIndicators,
  isDistributionFresh,
  fiiSourceLabel,
  latestDistributionReferenceMonth,
  latestRecordWithNav,
  latestRecordWithQuotaCount,
} from "./fii-indicators";
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
      rec(`${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01`, 100, 1_000_000, 1.0),
    );
    const result = computeFiiIndicators(records, null);
    // Should sum only the last 12 months (12 × 1.0 = 12.0), not all 14
    expect(result?.twelveMonthDistributionPerShare).toBeCloseTo(12.0);
    expect(result?.distributionCoverageMonths).toBe(12);
  });

  it("returns null for twelveMonthDist when all distributions are null", () => {
    const records = [
      rec("2024-11-30", 100, null, null),
      rec("2024-12-31", 100, null, null),
    ];
    const result = computeFiiIndicators(records, null);
    expect(result?.twelveMonthDistributionPerShare).toBeNull();
  });

  it("sums only non-null distribution values (partial coverage, ≥6 months)", () => {
    const records = Array.from({ length: 12 }, (_, i) =>
      rec(`2024-${String(i + 1).padStart(2, "0")}-28`, 100, null, i % 2 === 0 ? 1.0 : null),
    );
    // 6 non-null months (i=0,2,4,6,8,10), sum = 6.0
    const result = computeFiiIndicators(records, null);
    expect(result?.twelveMonthDistributionPerShare).toBeCloseTo(6.0);
    expect(result?.distributionCoverageMonths).toBe(6);
  });

  it("returns null for twelveMonthDist when fewer than 6 valid months", () => {
    const records = Array.from({ length: 10 }, (_, i) =>
      rec(`2024-${String(i + 1).padStart(2, "0")}-28`, 100, null, i < 4 ? 1.0 : null),
    );
    // Only 4 non-null months — below threshold
    const result = computeFiiIndicators(records, null);
    expect(result?.twelveMonthDistributionPerShare).toBeNull();
    expect(result?.dividendYield12m).toBeNull();
    expect(result?.distributionCoverageMonths).toBe(4);
  });

  it("returns null for DY 12m when coverage is insufficient even with market price", () => {
    const records = Array.from({ length: 5 }, (_, i) =>
      rec(`2024-${String(i + 1).padStart(2, "0")}-28`, 100, null, 1.0),
    );
    // 5 non-null months — below threshold of 6
    const result = computeFiiIndicators(records, 120);
    expect(result?.twelveMonthDistributionPerShare).toBeNull();
    expect(result?.dividendYield12m).toBeNull();
  });

  it("returns correct distributionCoverageMonths when all 12 months have data", () => {
    const records = Array.from({ length: 12 }, (_, i) =>
      rec(`2024-${String(i + 1).padStart(2, "0")}-28`, 100, null, 1.0),
    );
    const result = computeFiiIndicators(records, null);
    expect(result?.distributionCoverageMonths).toBe(12);
  });

  it("returns zero distributionCoverageMonths when all distributions are null", () => {
    const records = Array.from({ length: 10 }, (_, i) =>
      rec(`2024-${String(i + 1).padStart(2, "0")}-28`, 100, null, null),
    );
    const result = computeFiiIndicators(records, null);
    expect(result?.distributionCoverageMonths).toBe(0);
    expect(result?.twelveMonthDistributionPerShare).toBeNull();
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
    // 1 month < 6-month threshold → twelveMonthDist is null
    expect(result?.twelveMonthDistributionPerShare).toBeNull();
    expect(result?.distributionCoverageMonths).toBe(1);
    expect(result?.priceToBookValuePerShare).toBeCloseTo(105 / 98.5);
  });
});

describe("fiiSourceLabel", () => {
  it("names Fundos.Net only when it supplied a month", () => {
    const cvmOnly = rec("2026-01-01", 10, 1, 0.1);
    const fnet = { ...cvmOnly, distributionSource: "fnet_structured" as const };
    expect(fiiSourceLabel([cvmOnly])).toBe("CVM Informe Mensal");
    expect(fiiSourceLabel([cvmOnly, fnet])).toBe("CVM Informe Mensal · Rendimentos: B3 Fundos.Net");
  });

  it("amortization never enters the distribution metrics", () => {
    const r = { ...rec("2026-01-01", 10, 1, 0.1), monthlyAmortizationPerShare: 5 };
    const ind = computeFiiIndicators(Array.from({ length: 6 }, (_, i) => ({ ...r, referenceDate: `2026-0${i + 1}-01` })), 10);
    expect(ind?.twelveMonthDistributionPerShare).toBeCloseTo(0.6);
    expect(ind?.lastDistributionPerShare).toBe(0.1);
  });
});

describe("NAV and distribution freshness", () => {
  // CVM NAV through 2026-09; Fundos.Net distributions through 2026-10.
  const month = (i: number) => {
    const d = new Date(Date.UTC(2025, 9 + i, 1)); // i = 0 → 2025-10
    return d.toISOString().slice(0, 10);
  };
  const cvm = Array.from({ length: 12 }, (_, i) => ({ ...rec(month(i), 9 + i / 100, 1, 0.1), quotaCount: 1000 + i }));
  const fnetOnly: FiiFinancialRecord = {
    ...rec("2026-10-01", null, null, 0.095), quotaCount: null, source: "fii_fnet_only", distributionSource: "fnet_structured",
  };
  const records = [...cvm, fnetOnly];

  it("latest NAV / quota helpers skip a newer distribution-only record", () => {
    expect(latestRecordWithNav(records)?.referenceDate).toBe("2026-09-01");
    expect(latestRecordWithQuotaCount(records)?.referenceDate).toBe("2026-09-01");
    expect(latestDistributionReferenceMonth(records)).toBe("2026-10");
  });

  it("P/VP and VP use the latest NAV, not the FNET-only month", () => {
    const ind = computeFiiIndicators(records, 10)!;
    expect(ind.netAssetValuePerShare).toBeCloseTo(9.11);
    expect(ind.priceToBookValuePerShare).toBeCloseTo(10 / 9.11);
    expect(ind.navReferenceDate).toBe("2026-09-01");
    expect(ind.distributionReferenceDate).toBe("2026-10-01");
  });

  it("the 12-month window ends at the latest distribution month", () => {
    expect(distributionWindowMonths(records)).toEqual([
      "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04",
      "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10",
    ]);
    const ind = computeFiiIndicators(records, 10)!;
    expect(ind.distributionWindowEnd).toBe("2026-10-01");
    expect(ind.lastDistributionPerShare).toBe(0.095);
    expect(ind.twelveMonthDistributionPerShare).toBeCloseTo(11 * 0.1 + 0.095);
    expect(ind.distributionCoverageMonths).toBe(12);
  });

  it("a gap month inside the window is missing, even without a record", () => {
    const gapped = records.filter(r => r.referenceDate !== "2026-03-01");
    expect(computeFiiIndicators(gapped, null)?.distributionCoverageMonths).toBe(11);
  });

  it("an explicit 0 counts as covered; null does not", () => {
    const zero = records.map(r => (r.referenceDate === "2026-05-01" ? { ...r, monthlyDistributionPerShare: 0 } : r));
    const none = records.map(r => (r.referenceDate === "2026-05-01" ? { ...r, monthlyDistributionPerShare: null } : r));
    expect(computeFiiIndicators(zero, null)?.distributionCoverageMonths).toBe(12);
    expect(computeFiiIndicators(none, null)?.distributionCoverageMonths).toBe(11);
  });

  it("the CVM diagnostic estimate is never counted", () => {
    const estimatesOnly = cvm.map(r => ({ ...r, monthlyDistributionPerShare: null, cvmDerivedDistributionEstimate: 0.1 }));
    const ind = computeFiiIndicators(estimatesOnly, 10)!;
    expect(ind.distributionCoverageMonths).toBe(0);
    expect(ind.twelveMonthDistributionPerShare).toBeNull();
    expect(ind.lastDistributionPerShare).toBeNull();
  });

  it("the window still ends at the latest distribution month when NAV is newer", () => {
    const navAhead = cvm.map((r, i) => (i >= 10 ? { ...r, monthlyDistributionPerShare: null } : r));
    // Distributions through 2026-07, NAV through 2026-09.
    expect(distributionWindowMonths(navAhead).at(-1)).toBe("2026-07");
  });
});

describe("distribution freshness (FII_MAX_DISTRIBUTION_LAG_MONTHS)", () => {
  const series = (navEnd: string, distEnd: string): FiiFinancialRecord[] => {
    const months = ["2026-08", "2026-09", "2026-10", "2026-11"];
    return months
      .filter(m => m <= navEnd || m <= distEnd)
      .map(m => ({
        ...rec(`${m}-01`, m <= navEnd ? 10 : null, m <= navEnd ? 1 : null, m <= distEnd ? 0.1 : null),
        source: m <= navEnd ? "fii_cvm_cache" as const : "fii_fnet_only" as const,
      }));
  };

  it("is one calendar month", () => {
    expect(FII_MAX_DISTRIBUTION_LAG_MONTHS).toBe(1);
  });

  it("one-month lag is fresh (NAV 2026-10 / distribution 2026-09)", () => {
    const r = series("2026-10", "2026-09");
    expect(distributionLagMonths(r)).toBe(1);
    expect(computeFiiIndicators(r, null)?.distributionFresh).toBe(true);
  });

  it("two-month lag is stale (NAV 2026-11 / distribution 2026-09)", () => {
    const r = series("2026-11", "2026-09");
    expect(distributionLagMonths(r)).toBe(2);
    expect(isDistributionFresh(2)).toBe(false);
    expect(computeFiiIndicators(r, null)?.distributionFresh).toBe(false);
  });

  it("a distribution newer than NAV is valid (NAV 2026-09 / distribution 2026-10)", () => {
    const r = series("2026-09", "2026-10");
    expect(distributionLagMonths(r)).toBe(-1);
    expect(computeFiiIndicators(r, null)?.distributionFresh).toBe(true);
  });

  it("no distribution at all is never fresh", () => {
    expect(distributionLagMonths(series("2026-09", "2026-07").map(r => ({ ...r, monthlyDistributionPerShare: null })))).toBeNull();
    expect(isDistributionFresh(null)).toBe(false);
  });

});

describe("fiiDisplayIndicators (dashboard panel and report)", () => {
  it("computes indicators even though the cache stores indicators: null", () => {
    const records = Array.from({ length: 12 }, (_, i) => rec(`2026-${String(i + 1).padStart(2, "0")}-01`, 10, 1, 0.1));
    const cache = { records, indicators: null };
    const ind = fiiDisplayIndicators(cache, 9)!;
    expect(ind.netAssetValuePerShare).toBe(10);
    expect(ind.priceToBookValuePerShare).toBeCloseTo(0.9);
    expect(ind.lastDistributionPerShare).toBe(0.1);
    expect(ind.dividendYield12m).toBeCloseTo(1.2 / 9);
  });
});
