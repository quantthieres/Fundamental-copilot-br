import { describe, it, expect } from "vitest";
import { fmtForecastValue, fmtBacktestPct, selectDefaultMetric } from "./forecast-ui-utils";
import type { MetricForecastResult, ForecastMetric } from "./forecast-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeResult(
  metric: ForecastMetric,
  modelSelected: "naive" | "seasonal_naive" | "moving_average_4q" | "linear_trend" | null,
): MetricForecastResult {
  return {
    metric,
    label: metric,
    unit: "BRL_BILLION",
    frequency: "quarterly",
    lastObservedPeriod: "2025Q1",
    observations: 8,
    modelSelected,
    modelSelectionCriterion: modelSelected ? "lowest_wape_then_smape" : "insufficient_data",
    backtest: [],
    forecast: [],
    warnings: [],
    hasNegativeValues: false,
    hasLargeOutliers: false,
    quality: {
      level: "medium", score: 75, reasons: [], warnings: [],
      inputs: {
        observations: 8, wape: null, smape: null, mae: null, rmse: null,
        hasNegativeValues: false, hasLargeOutliers: false,
        hasIncompleteCurrentYear: false, forecastCoverage: 1,
      },
    },
  };
}

// ─── J. fmtForecastValue ──────────────────────────────────────────────────────

describe("fmtForecastValue (J)", () => {
  it("formats BRL_BILLION with R$ prefix and comma decimal", () => {
    expect(fmtForecastValue(9.47, "BRL_BILLION")).toBe("R$ 9,47 bi");
  });

  it("formats BRL_BILLION negative values", () => {
    expect(fmtForecastValue(-3.5, "BRL_BILLION")).toBe("R$ -3,50 bi");
  });

  it("formats PERCENTAGE stored as ratio (0.15 → 15,0%)", () => {
    expect(fmtForecastValue(0.15, "PERCENTAGE")).toBe("15,0%");
  });

  it("formats PERCENTAGE zero", () => {
    expect(fmtForecastValue(0, "PERCENTAGE")).toBe("0,0%");
  });

  it("formats RATIO to three decimal places", () => {
    expect(fmtForecastValue(1.234, "RATIO")).toBe("1,234");
  });

  it("returns em-dash for null", () => {
    expect(fmtForecastValue(null, "BRL_BILLION")).toBe("—");
    expect(fmtForecastValue(null, "PERCENTAGE")).toBe("—");
    expect(fmtForecastValue(null, "RATIO")).toBe("—");
  });
});

// ─── J. fmtBacktestPct ───────────────────────────────────────────────────────

describe("fmtBacktestPct (J)", () => {
  it("formats a ratio as percentage with one decimal", () => {
    expect(fmtBacktestPct(0.0654)).toBe("6,5%");
  });

  it("returns em-dash for null", () => {
    expect(fmtBacktestPct(null)).toBe("—");
  });
});

// ─── J. selectDefaultMetric ──────────────────────────────────────────────────

describe("selectDefaultMetric (J)", () => {
  it("returns revenue when available regardless of order", () => {
    const forecasts = [
      makeResult("ebit", "naive"),
      makeResult("revenue", "naive"),
    ];
    expect(selectDefaultMetric(forecasts)).toBe("revenue");
  });

  it("falls back to first metric with a model when revenue is absent", () => {
    const forecasts = [
      makeResult("ebit", null),
      makeResult("netIncome", "naive"),
    ];
    expect(selectDefaultMetric(forecasts)).toBe("netIncome");
  });

  it("falls back to first metric when all have null model", () => {
    const forecasts = [
      makeResult("ebit", null),
      makeResult("netIncome", null),
    ];
    expect(selectDefaultMetric(forecasts)).toBe("ebit");
  });

  it("returns null for empty array", () => {
    expect(selectDefaultMetric([])).toBeNull();
  });
});
