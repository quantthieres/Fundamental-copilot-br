import { describe, it, expect } from "vitest";
import { buildTickerTimeSeriesCache } from "./time-series-builder";
import type { QuarterlyFinancialRecord } from "@/lib/cvm/types";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

const PERIOD_END: Record<1 | 2 | 3 | 4, string> = {
  1: "03-31",
  2: "06-30",
  3: "09-30",
  4: "12-31",
};

function makeRecord(
  fiscalYear: number,
  quarter: 1 | 2 | 3 | 4,
  overrides: Partial<QuarterlyFinancialRecord> = {},
): QuarterlyFinancialRecord {
  return {
    ticker: "TEST",
    fiscalYear,
    quarter,
    period: `${fiscalYear}Q${quarter}`,
    periodEndDate: `${fiscalYear}-${PERIOD_END[quarter]}`,
    revenue: null,
    ebit: null,
    netIncome: null,
    operatingCashFlow: null,
    capex: null,
    freeCashFlow: null,
    cash: null,
    totalDebt: null,
    netDebt: null,
    source: "cvm_itr",
    ...overrides,
  };
}

const BASE_INPUT = { ticker: "TEST", companyName: "Test Co." };

// ─── A. Raw series generation ─────────────────────────────────────────────────

describe("A — raw series generation", () => {
  it("returns revenue and ebit series sorted chronologically even when input is unsorted", () => {
    const quarterly = [
      makeRecord(2024, 2, { revenue: 200, ebit: 40 }),
      makeRecord(2024, 1, { revenue: 100, ebit: 20 }),
    ];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });

    const revenue = cache.series.find((s) => s.metric === "revenue");
    const ebit = cache.series.find((s) => s.metric === "ebit");

    expect(revenue).toBeDefined();
    expect(ebit).toBeDefined();
    expect(revenue!.points[0].period).toBe("2024Q1");
    expect(revenue!.points[1].period).toBe("2024Q2");
    expect(revenue!.points[0].value).toBe(100);
    expect(revenue!.points[1].value).toBe(200);
    expect(ebit!.points[0].value).toBe(20);
    expect(ebit!.points[1].value).toBe(40);
  });

  it("includes all nine raw metric series", () => {
    const quarterly = [makeRecord(2024, 1)];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const rawMetrics = [
      "revenue", "ebit", "netIncome", "operatingCashFlow", "capex",
      "freeCashFlow", "cash", "totalDebt", "netDebt",
    ];
    for (const m of rawMetrics) {
      expect(cache.series.find((s) => s.metric === m)).toBeDefined();
    }
  });

  it("preserves source field from raw records", () => {
    const quarterly = [
      makeRecord(2024, 1, { revenue: 100, source: "cvm_itr" }),
      makeRecord(2024, 4, { revenue: 400, source: "cvm_dfp_derived_q4" }),
    ];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const revenue = cache.series.find((s) => s.metric === "revenue")!;
    expect(revenue.points[0].source).toBe("cvm_itr");
    expect(revenue.points[1].source).toBe("cvm_dfp_derived_q4");
  });
});

// ─── B. Margin derivation ─────────────────────────────────────────────────────

describe("B — margin derivation", () => {
  it("computes ebitMargin = ebit / revenue", () => {
    const quarterly = [makeRecord(2024, 1, { revenue: 100, ebit: 20 })];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const ebitMargin = cache.series.find((s) => s.metric === "ebitMargin")!;
    expect(ebitMargin.points[0].value).toBeCloseTo(0.2);
    expect(ebitMargin.points[0].source).toBe("derived");
  });

  it("computes netMargin = netIncome / revenue", () => {
    const quarterly = [makeRecord(2024, 1, { revenue: 200, netIncome: 30 })];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const netMargin = cache.series.find((s) => s.metric === "netMargin")!;
    expect(netMargin.points[0].value).toBeCloseTo(0.15);
  });

  it("computes freeCashFlowMargin = freeCashFlow / revenue", () => {
    const quarterly = [makeRecord(2024, 1, { revenue: 50, freeCashFlow: 10 })];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const fcfMargin = cache.series.find((s) => s.metric === "freeCashFlowMargin")!;
    expect(fcfMargin.points[0].value).toBeCloseTo(0.2);
  });

  it("allows negative numerator (negative EBIT margin)", () => {
    const quarterly = [makeRecord(2024, 1, { revenue: 100, ebit: -15 })];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const ebitMargin = cache.series.find((s) => s.metric === "ebitMargin")!;
    expect(ebitMargin.points[0].value).toBeCloseTo(-0.15);
  });
});

// ─── C. Null denominator ──────────────────────────────────────────────────────

describe("C — null denominator", () => {
  it("returns null ebitMargin when revenue is null", () => {
    const quarterly = [makeRecord(2024, 1, { revenue: null, ebit: 20 })];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const ebitMargin = cache.series.find((s) => s.metric === "ebitMargin")!;
    expect(ebitMargin.points[0].value).toBeNull();
  });

  it("returns null ebitMargin when revenue is zero", () => {
    const quarterly = [makeRecord(2024, 1, { revenue: 0, ebit: 20 })];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const ebitMargin = cache.series.find((s) => s.metric === "ebitMargin")!;
    expect(ebitMargin.points[0].value).toBeNull();
  });

  it("returns null margin when numerator is null", () => {
    const quarterly = [makeRecord(2024, 1, { revenue: 100, ebit: null })];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const ebitMargin = cache.series.find((s) => s.metric === "ebitMargin")!;
    expect(ebitMargin.points[0].value).toBeNull();
  });

  it("returns null netMargin when revenue is null", () => {
    const quarterly = [makeRecord(2024, 1, { revenue: null, netIncome: 10 })];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const netMargin = cache.series.find((s) => s.metric === "netMargin")!;
    expect(netMargin.points[0].value).toBeNull();
  });
});

// ─── D. YoY growth ────────────────────────────────────────────────────────────

describe("D — YoY growth", () => {
  it("computes revenueYoYGrowth = revenue_t / revenue_t-4 − 1", () => {
    const quarterly = [
      makeRecord(2023, 1, { revenue: 100 }),
      makeRecord(2024, 1, { revenue: 125 }),
    ];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const yoy = cache.series.find((s) => s.metric === "revenueYoYGrowth")!;
    expect(yoy.points[0].value).toBeNull(); // 2023Q1 has no t-4
    expect(yoy.points[1].value).toBeCloseTo(0.25); // 125/100 − 1
  });

  it("computes ebitYoYGrowth correctly", () => {
    const quarterly = [
      makeRecord(2022, 2, { ebit: 50 }),
      makeRecord(2023, 2, { ebit: 75 }),
    ];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const yoy = cache.series.find((s) => s.metric === "ebitYoYGrowth")!;
    expect(yoy.points[0].value).toBeNull();
    expect(yoy.points[1].value).toBeCloseTo(0.5); // 75/50 − 1
  });

  it("computes netIncomeYoYGrowth with negative current value", () => {
    const quarterly = [
      makeRecord(2023, 3, { netIncome: 100 }),
      makeRecord(2024, 3, { netIncome: -20 }),
    ];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const yoy = cache.series.find((s) => s.metric === "netIncomeYoYGrowth")!;
    expect(yoy.points[1].value).toBeCloseTo(-1.2); // −20/100 − 1
  });

  it("uses same quarter previous year (not position t-4 in array)", () => {
    // Only Q1 records; no Q2 or Q3 in between
    const quarterly = [
      makeRecord(2022, 1, { revenue: 80 }),
      makeRecord(2023, 1, { revenue: 100 }),
      makeRecord(2024, 1, { revenue: 120 }),
    ];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const yoy = cache.series.find((s) => s.metric === "revenueYoYGrowth")!;
    expect(yoy.points[0].value).toBeNull();
    expect(yoy.points[1].value).toBeCloseTo(100 / 80 - 1);
    expect(yoy.points[2].value).toBeCloseTo(120 / 100 - 1);
  });
});

// ─── E. Missing YoY values ────────────────────────────────────────────────────

describe("E — missing YoY values", () => {
  it("returns null when t-4 period does not exist in data", () => {
    const quarterly = [makeRecord(2024, 1, { revenue: 125 })];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const yoy = cache.series.find((s) => s.metric === "revenueYoYGrowth")!;
    expect(yoy.points[0].value).toBeNull();
  });

  it("returns null when t-4 value is null even if period exists", () => {
    const quarterly = [
      makeRecord(2023, 1, { revenue: null }),
      makeRecord(2024, 1, { revenue: 125 }),
    ];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const yoy = cache.series.find((s) => s.metric === "revenueYoYGrowth")!;
    expect(yoy.points[1].value).toBeNull();
  });

  it("returns null when t-4 value is zero (division by zero guard)", () => {
    const quarterly = [
      makeRecord(2023, 1, { revenue: 0 }),
      makeRecord(2024, 1, { revenue: 125 }),
    ];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const yoy = cache.series.find((s) => s.metric === "revenueYoYGrowth")!;
    expect(yoy.points[1].value).toBeNull();
  });

  it("returns null when current value is null", () => {
    const quarterly = [
      makeRecord(2023, 1, { revenue: 100 }),
      makeRecord(2024, 1, { revenue: null }),
    ];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const yoy = cache.series.find((s) => s.metric === "revenueYoYGrowth")!;
    expect(yoy.points[1].value).toBeNull();
  });
});

// ─── F. Null preservation ─────────────────────────────────────────────────────

describe("F — null preservation", () => {
  it("capex null remains null in raw series", () => {
    const quarterly = [makeRecord(2024, 1, { capex: null })];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const capex = cache.series.find((s) => s.metric === "capex")!;
    expect(capex.points[0].value).toBeNull();
  });

  it("zero is preserved as zero, not treated as null", () => {
    const quarterly = [makeRecord(2024, 1, { capex: 0, revenue: 0 })];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const capex = cache.series.find((s) => s.metric === "capex")!;
    const revenue = cache.series.find((s) => s.metric === "revenue")!;
    expect(capex.points[0].value).toBe(0);
    expect(revenue.points[0].value).toBe(0);
  });

  it("multiple null metrics in same record are all null", () => {
    const quarterly = [makeRecord(2024, 1)]; // all nulls by default
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const rawMetrics = [
      "revenue", "ebit", "netIncome", "operatingCashFlow", "capex",
      "freeCashFlow", "cash", "totalDebt", "netDebt",
    ];
    for (const m of rawMetrics) {
      const series = cache.series.find((s) => s.metric === m)!;
      expect(series.points[0].value).toBeNull();
    }
  });
});

// ─── G. Quality metadata ──────────────────────────────────────────────────────

describe("G — quality metadata", () => {
  it("counts observations and missing correctly", () => {
    const quarterly = [
      makeRecord(2024, 1, { revenue: 100 }),
      makeRecord(2024, 2, { revenue: null }),
      makeRecord(2024, 3, { revenue: 120 }),
    ];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const revenue = cache.series.find((s) => s.metric === "revenue")!;
    expect(revenue.quality.observations).toBe(2);
    expect(revenue.quality.missing).toBe(1);
  });

  it("sets startPeriod and endPeriod from non-null values", () => {
    const quarterly = [
      makeRecord(2024, 1, { revenue: null }),
      makeRecord(2024, 2, { revenue: 200 }),
      makeRecord(2024, 3, { revenue: 220 }),
      makeRecord(2024, 4, { revenue: null }),
    ];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const revenue = cache.series.find((s) => s.metric === "revenue")!;
    expect(revenue.quality.startPeriod).toBe("2024Q2");
    expect(revenue.quality.endPeriod).toBe("2024Q3");
  });

  it("returns null startPeriod and endPeriod when all values are null", () => {
    const quarterly = [makeRecord(2024, 1), makeRecord(2024, 2)];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const revenue = cache.series.find((s) => s.metric === "revenue")!;
    expect(revenue.quality.startPeriod).toBeNull();
    expect(revenue.quality.endPeriod).toBeNull();
    expect(revenue.quality.observations).toBe(0);
    expect(revenue.quality.missing).toBe(2);
  });

  it("flags hasNegativeValues when any non-null value is negative", () => {
    const quarterly = [
      makeRecord(2024, 1, { netIncome: 10 }),
      makeRecord(2024, 2, { netIncome: -5 }),
    ];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const netIncome = cache.series.find((s) => s.metric === "netIncome")!;
    expect(netIncome.quality.hasNegativeValues).toBe(true);
  });

  it("does not flag hasNegativeValues when all values are positive", () => {
    const quarterly = [makeRecord(2024, 1, { revenue: 100 }), makeRecord(2024, 2, { revenue: 120 })];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const revenue = cache.series.find((s) => s.metric === "revenue")!;
    expect(revenue.quality.hasNegativeValues).toBe(false);
  });

  it("flags hasLargeOutliers when QoQ change exceeds 500%", () => {
    const quarterly = [
      makeRecord(2024, 1, { revenue: 1 }),
      makeRecord(2024, 2, { revenue: 20 }), // 1900% change
    ];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const revenue = cache.series.find((s) => s.metric === "revenue")!;
    expect(revenue.quality.hasLargeOutliers).toBe(true);
  });

  it("does not flag hasLargeOutliers for normal changes", () => {
    const quarterly = [
      makeRecord(2024, 1, { revenue: 100 }),
      makeRecord(2024, 2, { revenue: 110 }),
      makeRecord(2024, 3, { revenue: 95 }),
    ];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const revenue = cache.series.find((s) => s.metric === "revenue")!;
    expect(revenue.quality.hasLargeOutliers).toBe(false);
  });

  it("does not flag hasLargeOutliers when previous value is near zero", () => {
    const quarterly = [
      makeRecord(2024, 1, { revenue: 0.00001 }), // near zero
      makeRecord(2024, 2, { revenue: 100 }),
    ];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const revenue = cache.series.find((s) => s.metric === "revenue")!;
    expect(revenue.quality.hasLargeOutliers).toBe(false);
  });
});

// ─── Output structure ─────────────────────────────────────────────────────────

describe("TickerTimeSeriesCache output structure", () => {
  it("sets source to normalized_financial_time_series", () => {
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly: [] });
    expect(cache.source).toBe("normalized_financial_time_series");
  });

  it("sets inputSource to cvm_itr_quarterly_cache", () => {
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly: [] });
    expect(cache.inputSource).toBe("cvm_itr_quarterly_cache");
  });

  it("includes generatedAt as ISO timestamp", () => {
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly: [] });
    expect(() => new Date(cache.generatedAt)).not.toThrow();
    expect(cache.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("produces exactly 15 series", () => {
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly: [] });
    expect(cache.series).toHaveLength(15);
  });

  it("includes all derived metric series", () => {
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly: [] });
    const derived = ["ebitMargin", "netMargin", "freeCashFlowMargin", "revenueYoYGrowth", "ebitYoYGrowth", "netIncomeYoYGrowth"];
    for (const m of derived) {
      expect(cache.series.find((s) => s.metric === m)).toBeDefined();
    }
  });

  it("all derived points have source === derived", () => {
    const quarterly = [makeRecord(2023, 1, { revenue: 100, ebit: 20 }), makeRecord(2024, 1, { revenue: 120, ebit: 24 })];
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    const derivedMetrics = ["ebitMargin", "netMargin", "freeCashFlowMargin", "revenueYoYGrowth", "ebitYoYGrowth", "netIncomeYoYGrowth"];
    for (const m of derivedMetrics) {
      const series = cache.series.find((s) => s.metric === m)!;
      for (const p of series.points) {
        expect(p.source).toBe("derived");
      }
    }
  });

  it("warns about short history", () => {
    const quarterly = [makeRecord(2024, 1, { revenue: 100 })]; // only 1 quarter
    const cache = buildTickerTimeSeriesCache({ ...BASE_INPUT, quarterly });
    expect(cache.warnings.some((w) => w.includes("curto"))).toBe(true);
  });
});
