import { describe, it, expect } from "vitest";
import { buildBaselineForecastCache } from "./baseline-forecast-builder";
import type { TickerTimeSeriesCache } from "./time-series-types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeRevenueSeries(
  points: Array<{ period: string; value: number | null }>,
  opts: { hasLargeOutliers?: boolean; hasNegativeValues?: boolean } = {},
): TickerTimeSeriesCache["series"][0] {
  const nonNull = points.filter(p => p.value !== null);
  return {
    metric: "revenue",
    label: "Receita líquida",
    unit: "BRL_BILLION",
    frequency: "quarterly",
    points: points.map(p => ({ ...p, periodEndDate: "", source: "cvm_itr" as const })),
    quality: {
      observations:    nonNull.length,
      missing:         points.length - nonNull.length,
      startPeriod:     nonNull[0]?.period ?? null,
      endPeriod:       nonNull[nonNull.length - 1]?.period ?? null,
      hasNegativeValues: opts.hasNegativeValues ?? false,
      hasLargeOutliers:  opts.hasLargeOutliers  ?? false,
    },
  };
}

function makeCache(
  series: TickerTimeSeriesCache["series"],
): TickerTimeSeriesCache {
  return {
    ticker: "TEST3",
    companyName: "Test SA",
    source: "normalized_financial_time_series",
    generatedAt: new Date().toISOString(),
    inputSource: "cvm_itr_quarterly_cache",
    series,
    warnings: [],
  };
}

// 10-quarter revenue series with clear upward trend.
const TREND_POINTS = [
  { period: "2022Q1", value: 3.0 },
  { period: "2022Q2", value: 3.5 },
  { period: "2022Q3", value: 4.0 },
  { period: "2022Q4", value: 4.5 },
  { period: "2023Q1", value: 5.0 },
  { period: "2023Q2", value: 5.5 },
  { period: "2023Q3", value: 6.0 },
  { period: "2023Q4", value: 6.5 },
  { period: "2024Q1", value: 7.0 },
  { period: "2024Q2", value: 7.5 },
];

// ─── H. Forecast builder ──────────────────────────────────────────────────────

describe("buildBaselineForecastCache (H)", () => {
  it("produces a well-formed BaselineForecastCache", () => {
    const cache = buildBaselineForecastCache(
      makeCache([makeRevenueSeries(TREND_POINTS)]),
    );
    expect(cache.ticker).toBe("TEST3");
    expect(cache.source).toBe("baseline_forecast_cache");
    expect(cache.inputSource).toBe("normalized_financial_time_series");
    expect(typeof cache.generatedAt).toBe("string");
    expect(Array.isArray(cache.forecasts)).toBe(true);
  });

  it("produces a revenue forecast with modelSelected set", () => {
    const cache = buildBaselineForecastCache(
      makeCache([makeRevenueSeries(TREND_POINTS)]),
    );
    const revenueForecast = cache.forecasts.find(f => f.metric === "revenue");
    expect(revenueForecast).toBeDefined();
    expect(revenueForecast!.modelSelected).not.toBeNull();
    expect(revenueForecast!.observations).toBe(10);
  });

  it("revenue forecast has 8 points by default", () => {
    const cache = buildBaselineForecastCache(
      makeCache([makeRevenueSeries(TREND_POINTS)]),
    );
    const rev = cache.forecasts.find(f => f.metric === "revenue")!;
    expect(rev.forecast).toHaveLength(8);
  });

  it("respects custom horizonQuarters", () => {
    const cache = buildBaselineForecastCache(
      makeCache([makeRevenueSeries(TREND_POINTS)]),
      { horizonQuarters: 4 },
    );
    const rev = cache.forecasts.find(f => f.metric === "revenue")!;
    expect(rev.forecast).toHaveLength(4);
    expect(cache.horizonQuarters).toBe(4);
  });

  it("forecast points have yhat, yhatLower, yhatUpper (non-null for sufficient data)", () => {
    const cache = buildBaselineForecastCache(
      makeCache([makeRevenueSeries(TREND_POINTS)]),
    );
    const rev = cache.forecasts.find(f => f.metric === "revenue")!;
    for (const fp of rev.forecast) {
      expect(fp.yhat).not.toBeNull();
      // Intervals are non-null when the selected model has backtest metrics
      expect(fp.horizon).toBeGreaterThanOrEqual(1);
    }
  });

  it("includes interval warning when forecast points have yhat", () => {
    const cache = buildBaselineForecastCache(
      makeCache([makeRevenueSeries(TREND_POINTS)]),
    );
    const rev = cache.forecasts.find(f => f.metric === "revenue")!;
    expect(rev.warnings.some(w => w.includes("heurísticas"))).toBe(true);
  });

  it("includes outlier warning when input has hasLargeOutliers=true", () => {
    const series = makeRevenueSeries(TREND_POINTS, { hasLargeOutliers: true });
    const cache = buildBaselineForecastCache(makeCache([series]));
    const rev = cache.forecasts.find(f => f.metric === "revenue")!;
    expect(rev.warnings.some(w => w.toLowerCase().includes("outlier"))).toBe(true);
  });

  it("includes negative-values warning when input has hasNegativeValues=true", () => {
    const series = makeRevenueSeries(TREND_POINTS, { hasNegativeValues: true });
    const cache = buildBaselineForecastCache(makeCache([series]));
    const rev = cache.forecasts.find(f => f.metric === "revenue")!;
    expect(rev.warnings.some(w => w.includes("negativo"))).toBe(true);
  });

  it("modelSelected is null and forecast is empty for insufficient data", () => {
    // Only 0 observations — can't forecast
    const sparse = makeRevenueSeries([]);
    const cache = buildBaselineForecastCache(makeCache([sparse]));
    const rev = cache.forecasts.find(f => f.metric === "revenue")!;
    expect(rev.modelSelected).toBeNull();
    expect(rev.modelSelectionCriterion).toBe("insufficient_data");
    expect(rev.forecast.every(p => p.yhat === null)).toBe(true);
  });

  it("metrics missing from time-series cache appear with a global warning", () => {
    // Only revenue series provided; all other metrics should be absent
    const cache = buildBaselineForecastCache(
      makeCache([makeRevenueSeries(TREND_POINTS)]),
    );
    // Global warnings mention missing metrics
    expect(cache.warnings.some(w => w.includes("ebit"))).toBe(true);
  });

  it("does not select a model with partial null forecasts when another has full coverage", () => {
    // Gap in 2021Q3-Q4 means seasonal_naive returns null for h=1,2 (lags 2021Q3,Q4)
    // and null for h=5,6 (recursive from null h=1,2). Other models produce full coverage.
    // seasonal_naive has WAPE≈0 (perfect on this seasonal data) so without the
    // coverage-aware filter it would be selected despite producing partial nulls.
    const series = makeRevenueSeries([
      { period: "2019Q1", value: 10 }, { period: "2019Q2", value: 12 },
      { period: "2019Q3", value: 14 }, { period: "2019Q4", value: 11 },
      { period: "2020Q1", value: 10 }, { period: "2020Q2", value: 12 },
      { period: "2020Q3", value: 14 }, { period: "2020Q4", value: 11 },
      { period: "2021Q1", value: 10 }, { period: "2021Q2", value: 12 },
      { period: "2021Q3", value: null }, { period: "2021Q4", value: null },
      { period: "2022Q1", value: 10 }, { period: "2022Q2", value: 12 },
    ]);
    const cache = buildBaselineForecastCache(makeCache([series]));
    const rev = cache.forecasts.find(f => f.metric === "revenue")!;
    expect(rev.modelSelected).not.toBe("seasonal_naive");
    expect(rev.forecast.every(p => p.yhat !== null)).toBe(true);
  });

  it("produces 8 non-null yhat for a PETR4 EBIT-like series ending in Q3", () => {
    // Seasonal series ending at Q3 (like PETR4 EBIT 2025Q3).
    // h=1..4 lags are in history; h=5..8 lags are not (next year Q4..Q3 not yet observed).
    // After the recursive fix, seasonal_naive extends the pattern and covers all 8 horizons.
    const series = makeRevenueSeries([
      { period: "2023Q1", value: 5.0 }, { period: "2023Q2", value: 7.0 },
      { period: "2023Q3", value: 9.0 }, { period: "2023Q4", value: 6.0 },
      { period: "2024Q1", value: 5.5 }, { period: "2024Q2", value: 7.5 },
      { period: "2024Q3", value: 9.5 }, { period: "2024Q4", value: 6.5 },
      { period: "2025Q1", value: 6.0 }, { period: "2025Q2", value: 8.0 },
      { period: "2025Q3", value: 10.0 },
    ]);
    const cache = buildBaselineForecastCache(makeCache([series]));
    const rev = cache.forecasts.find(f => f.metric === "revenue")!;
    expect(rev.lastObservedPeriod).toBe("2025Q3");
    expect(rev.forecast).toHaveLength(8);
    expect(rev.forecast.every(p => p.yhat !== null)).toBe(true);
  });

  it("allows null forecast points when all eligible models lack sufficient backtest data", () => {
    // 1 non-null obs → naive is eligible but testSize=0 → all backtest metrics null
    // → selectBestModel returns null → all forecast points remain null yhat.
    const sparse = makeRevenueSeries([{ period: "2024Q1", value: 5.0 }]);
    const cache = buildBaselineForecastCache(makeCache([sparse]));
    const rev = cache.forecasts.find(f => f.metric === "revenue")!;
    expect(rev.modelSelected).toBeNull();
    expect(rev.modelSelectionCriterion).toBe("insufficient_data");
    expect(rev.forecast.every(p => p.yhat === null)).toBe(true);
  });

  it("lastObservedPeriod matches the final non-null point", () => {
    const cache = buildBaselineForecastCache(
      makeCache([makeRevenueSeries(TREND_POINTS)]),
    );
    const rev = cache.forecasts.find(f => f.metric === "revenue")!;
    expect(rev.lastObservedPeriod).toBe("2024Q2");
  });

  it("forecast periods start immediately after lastObservedPeriod", () => {
    const cache = buildBaselineForecastCache(
      makeCache([makeRevenueSeries(TREND_POINTS)]),
    );
    const rev = cache.forecasts.find(f => f.metric === "revenue")!;
    expect(rev.forecast[0].period).toBe("2024Q3");
    expect(rev.forecast[0].horizon).toBe(1);
  });

  it("backtest array contains results for all eligible models", () => {
    const cache = buildBaselineForecastCache(
      makeCache([makeRevenueSeries(TREND_POINTS)]),
    );
    const rev = cache.forecasts.find(f => f.metric === "revenue")!;
    // 10 obs → all 4 models are eligible
    const modelNames = rev.backtest.map(b => b.model);
    expect(modelNames).toContain("naive");
    expect(modelNames).toContain("moving_average_4q");
    expect(modelNames).toContain("seasonal_naive");
    expect(modelNames).toContain("linear_trend");
  });
});
