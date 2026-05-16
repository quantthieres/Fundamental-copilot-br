import { describe, it, expect } from "vitest";
import {
  parseBaselineForecastCache,
  getPrecomputedBaselineForecast,
} from "./baseline-forecast-cache";
import type { BaselineForecastCache, ForecastQualityDiagnostic } from "./forecast-types";

const STUB_QUALITY: ForecastQualityDiagnostic = {
  level: "medium", score: 70, reasons: [], warnings: [],
  inputs: {
    observations: 12, wape: null, smape: null, mae: null, rmse: null,
    hasNegativeValues: false, hasLargeOutliers: false,
    hasIncompleteCurrentYear: false, forecastCoverage: 1,
  },
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_CACHE: BaselineForecastCache = {
  ticker:          "TEST3",
  companyName:     "Test SA",
  source:          "baseline_forecast_cache",
  generatedAt:     "2026-01-01T00:00:00.000Z",
  inputSource:     "normalized_financial_time_series",
  horizonQuarters: 8,
  forecasts:       [],
  warnings:        [],
};

// ─── I. parseBaselineForecastCache ────────────────────────────────────────────

describe("parseBaselineForecastCache (I)", () => {
  it("returns a valid cache object for correct JSON", () => {
    const result = parseBaselineForecastCache(JSON.stringify(VALID_CACHE));
    expect(result).not.toBeNull();
    expect(result!.ticker).toBe("TEST3");
    expect(result!.source).toBe("baseline_forecast_cache");
    expect(result!.forecasts).toHaveLength(0);
  });

  it("returns null for empty string", () => {
    expect(parseBaselineForecastCache("")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseBaselineForecastCache("{not valid json}")).toBeNull();
  });

  it("returns null when source field is wrong", () => {
    const bad = { ...VALID_CACHE, source: "something_else" };
    expect(parseBaselineForecastCache(JSON.stringify(bad))).toBeNull();
  });

  it("returns null when ticker is missing", () => {
    const { ticker: _ticker, ...bad } = VALID_CACHE;
    expect(parseBaselineForecastCache(JSON.stringify(bad))).toBeNull();
  });

  it("returns null when forecasts is not an array", () => {
    const bad = { ...VALID_CACHE, forecasts: "not-an-array" };
    expect(parseBaselineForecastCache(JSON.stringify(bad))).toBeNull();
  });

  it("returns null for non-object JSON (array, number, null)", () => {
    expect(parseBaselineForecastCache("[]")).toBeNull();
    expect(parseBaselineForecastCache("42")).toBeNull();
    expect(parseBaselineForecastCache("null")).toBeNull();
  });

  it("round-trips a cache with forecasts intact", () => {
    const withForecasts: BaselineForecastCache = {
      ...VALID_CACHE,
      forecasts: [{
        metric:                  "revenue",
        label:                   "Receita líquida",
        unit:                    "BRL_BILLION",
        frequency:               "quarterly",
        lastObservedPeriod:      "2025Q3",
        observations:            12,
        modelSelected:           "linear_trend",
        modelSelectionCriterion: "lowest_wape_then_smape",
        backtest:                [],
        forecast:                [{ period: "2025Q4", horizon: 1, yhat: 5.0, yhatLower: 4.5, yhatUpper: 5.5 }],
        warnings:                [],
        hasNegativeValues:       false,
        hasLargeOutliers:        false,
        quality:                 STUB_QUALITY,
      }],
    };
    const result = parseBaselineForecastCache(JSON.stringify(withForecasts));
    expect(result).not.toBeNull();
    expect(result!.forecasts[0].modelSelected).toBe("linear_trend");
    expect(result!.forecasts[0].forecast[0].yhat).toBe(5.0);
  });
});

// ─── I. getPrecomputedBaselineForecast ────────────────────────────────────────

describe("getPrecomputedBaselineForecast (I)", () => {
  it("returns null for a ticker with no cache file", () => {
    expect(getPrecomputedBaselineForecast("NONEXISTENT_TICKER_XYZ_999")).toBeNull();
  });

  it("normalizes ticker before reading (lowercase → uppercase, strips chars)", () => {
    // Should not throw; both calls target non-existent files and return null
    expect(getPrecomputedBaselineForecast("nonexistent_xyz_999")).toBeNull();
    expect(getPrecomputedBaselineForecast("test.3")).toBeNull();
  });
});
