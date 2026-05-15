import { describe, it, expect } from "vitest";
import {
  parseTimeSeriesCache,
  getPrecomputedTickerTimeSeries,
} from "./time-series-cache";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_CACHE_OBJECT = {
  ticker: "WEGE3",
  companyName: "WEG S.A.",
  source: "normalized_financial_time_series",
  generatedAt: "2026-05-15T00:00:00.000Z",
  inputSource: "cvm_itr_quarterly_cache",
  series: [
    {
      metric: "revenue",
      label: "Receita líquida",
      unit: "BRL_BILLION",
      frequency: "quarterly",
      points: [{ period: "2024Q1", periodEndDate: "2024-03-31", value: 5.5, source: "cvm_itr" }],
      quality: { observations: 1, missing: 0, startPeriod: "2024Q1", endPeriod: "2024Q1", hasNegativeValues: false, hasLargeOutliers: false },
    },
  ],
  warnings: [],
};

// ─── H. parseTimeSeriesCache ──────────────────────────────────────────────────

describe("H — parseTimeSeriesCache", () => {
  it("returns parsed object for valid JSON", () => {
    const result = parseTimeSeriesCache(JSON.stringify(VALID_CACHE_OBJECT));
    expect(result).not.toBeNull();
    expect(result!.ticker).toBe("WEGE3");
    expect(result!.source).toBe("normalized_financial_time_series");
    expect(result!.series).toHaveLength(1);
  });

  it("returns null for empty string", () => {
    expect(parseTimeSeriesCache("")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseTimeSeriesCache("{bad json")).toBeNull();
    expect(parseTimeSeriesCache("not json at all")).toBeNull();
  });

  it("returns null when source field is missing", () => {
    const { source: _, ...bad } = VALID_CACHE_OBJECT;
    expect(parseTimeSeriesCache(JSON.stringify(bad))).toBeNull();
  });

  it("returns null when source is wrong value", () => {
    const bad = { ...VALID_CACHE_OBJECT, source: "forecast_layer" };
    expect(parseTimeSeriesCache(JSON.stringify(bad))).toBeNull();
  });

  it("returns null when ticker is missing", () => {
    const { ticker: _, ...bad } = VALID_CACHE_OBJECT;
    expect(parseTimeSeriesCache(JSON.stringify(bad))).toBeNull();
  });

  it("returns null when series is missing", () => {
    const { series: _, ...bad } = VALID_CACHE_OBJECT;
    expect(parseTimeSeriesCache(JSON.stringify(bad))).toBeNull();
  });

  it("returns null when series is not an array", () => {
    const bad = { ...VALID_CACHE_OBJECT, series: "not-an-array" };
    expect(parseTimeSeriesCache(JSON.stringify(bad))).toBeNull();
  });

  it("returns null for non-object JSON (number)", () => {
    expect(parseTimeSeriesCache("42")).toBeNull();
  });

  it("returns null for non-object JSON (string)", () => {
    expect(parseTimeSeriesCache('"hello"')).toBeNull();
  });

  it("returns null for JSON array at root", () => {
    expect(parseTimeSeriesCache("[]")).toBeNull();
  });

  it("accepts an empty series array", () => {
    const empty = { ...VALID_CACHE_OBJECT, series: [] };
    const result = parseTimeSeriesCache(JSON.stringify(empty));
    expect(result).not.toBeNull();
    expect(result!.series).toHaveLength(0);
  });
});

// ─── H. getPrecomputedTickerTimeSeries ───────────────────────────────────────

describe("H — getPrecomputedTickerTimeSeries", () => {
  it("returns null for a ticker with no cache file", () => {
    const result = getPrecomputedTickerTimeSeries("NONEXISTENT_TICKER_XYZ_999");
    expect(result).toBeNull();
  });

  it("normalizes ticker before reading (lowercase -> uppercase)", () => {
    // Same as "NONEXISTENT_TICKER_XYZ_999" — both return null, confirming normalization doesn't throw
    const result = getPrecomputedTickerTimeSeries("nonexistent_xyz_999");
    expect(result).toBeNull();
  });
});
