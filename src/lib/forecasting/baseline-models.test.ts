import { describe, it, expect } from "vitest";
import {
  naiveForecast,
  seasonalNaiveForecast,
  movingAverage4qForecast,
  linearTrendForecast,
  fitOLS,
} from "./baseline-models";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pts(...values: (number | null)[]): Array<{ period: string; value: number | null }> {
  return values.map((v, i) => {
    const year  = 2020 + Math.floor(i / 4);
    const q     = (i % 4) + 1;
    return { period: `${year}Q${q}`, value: v };
  });
}

const FUTURE = ["2022Q4", "2023Q1"];

// ─── B. Naive forecast ────────────────────────────────────────────────────────

describe("naiveForecast (B)", () => {
  it("repeats last non-null value for all horizon steps", () => {
    const history = pts(100, 110, 120);
    const result  = naiveForecast(history, FUTURE);
    expect(result).toHaveLength(2);
    expect(result[0].yhat).toBeCloseTo(120);
    expect(result[1].yhat).toBeCloseTo(120);
  });

  it("assigns horizon 1-based index", () => {
    const result = naiveForecast(pts(5), ["2021Q1", "2021Q2"]);
    expect(result[0].horizon).toBe(1);
    expect(result[1].horizon).toBe(2);
  });

  it("returns null yhat when all historical values are null", () => {
    const result = naiveForecast(pts(null, null), FUTURE);
    expect(result[0].yhat).toBeNull();
  });

  it("skips trailing nulls and uses last non-null", () => {
    const result = naiveForecast(pts(50, null, null), FUTURE);
    expect(result[0].yhat).toBeCloseTo(50);
  });

  it("returns empty array for empty future periods", () => {
    expect(naiveForecast(pts(10), [])).toHaveLength(0);
  });

  it("yhatLower and yhatUpper are null (intervals applied by builder)", () => {
    const result = naiveForecast(pts(100), ["2021Q1"]);
    expect(result[0].yhatLower).toBeNull();
    expect(result[0].yhatUpper).toBeNull();
  });
});

// ─── C. Seasonal naive forecast ───────────────────────────────────────────────

describe("seasonalNaiveForecast (C)", () => {
  // History: 2020Q1..2021Q4 (8 quarters)
  const history8 = [
    { period: "2020Q1", value: 10 },
    { period: "2020Q2", value: 11 },
    { period: "2020Q3", value: 12 },
    { period: "2020Q4", value: 13 },
    { period: "2021Q1", value: 14 },
    { period: "2021Q2", value: 15 },
    { period: "2021Q3", value: 16 },
    { period: "2021Q4", value: 17 },
  ];

  it("2022Q1 forecast uses 2021Q1 value (same quarter, 1 year prior)", () => {
    const result = seasonalNaiveForecast(history8, ["2022Q1"]);
    expect(result[0].yhat).toBeCloseTo(14); // 2021Q1 = 14
  });

  it("2022Q2 forecast uses 2021Q2 value", () => {
    const result = seasonalNaiveForecast(history8, ["2022Q2"]);
    expect(result[0].yhat).toBeCloseTo(15);
  });

  it("returns null when same-quarter lag is missing (too far ahead)", () => {
    // 2023Q1 requires 2022Q1, but 2022Q1 is not in history
    const result = seasonalNaiveForecast(history8, ["2023Q1"]);
    expect(result[0].yhat).toBeNull();
  });

  it("returns null when lag value is null in history", () => {
    const historyWithNull = [
      ...history8.slice(0, 4),
      { period: "2021Q1", value: null }, // override 2021Q1 to null
      ...history8.slice(5),
    ];
    const result = seasonalNaiveForecast(historyWithNull, ["2022Q1"]);
    expect(result[0].yhat).toBeNull();
  });

  it("assigns correct horizon indices", () => {
    const result = seasonalNaiveForecast(history8, ["2022Q1", "2022Q2"]);
    expect(result[0].horizon).toBe(1);
    expect(result[1].horizon).toBe(2);
  });

  it("produces 8 non-null forecasts using recursive fill when h>4 lags are absent", () => {
    // history8 covers 2020Q1..2021Q4. Future extends to 2023Q4 (8 quarters).
    // h=1..4 (2022Q1..Q4): lags 2021Q1..Q4 are all in history → non-null.
    // h=5..8 (2023Q1..Q4): lags 2022Q1..Q4 are NOT in history → fall back to result[i-4].yhat.
    const future8 = ["2022Q1","2022Q2","2022Q3","2022Q4","2023Q1","2023Q2","2023Q3","2023Q4"];
    const result = seasonalNaiveForecast(history8, future8);
    expect(result).toHaveLength(8);
    expect(result.every(p => p.yhat !== null)).toBe(true);
    // Recursive values match same-quarter one season back in the forecast.
    expect(result[4].yhat).toBeCloseTo(result[0].yhat!); // 2023Q1 ← 2022Q1 ← 2021Q1=14
    expect(result[5].yhat).toBeCloseTo(result[1].yhat!); // 2023Q2 ← 2022Q2 ← 2021Q2=15
    expect(result[6].yhat).toBeCloseTo(result[2].yhat!); // 2023Q3 ← 2022Q3 ← 2021Q3=16
    expect(result[7].yhat).toBeCloseTo(result[3].yhat!); // 2023Q4 ← 2022Q4 ← 2021Q4=17
  });
});

// ─── D. Moving average forecast ───────────────────────────────────────────────

describe("movingAverage4qForecast (D)", () => {
  it("last four values [100, 110, 120, 130] → forecast ≈ 115", () => {
    const history = pts(100, 110, 120, 130);
    const result  = movingAverage4qForecast(history, ["2021Q1"]);
    expect(result[0].yhat).toBeCloseTo(115);
  });

  it("5 values: [100, 110, 120, 130, 140] → uses last 4 [110,120,130,140] → 125", () => {
    const history = pts(100, 110, 120, 130, 140);
    const result  = movingAverage4qForecast(history, ["2021Q2"]);
    expect(result[0].yhat).toBeCloseTo(125);
  });

  it("updates window recursively for h=2", () => {
    // Buf = [100, 110, 120, 130] → h=1 yhat=115 → buf=[110,120,130,115]
    // h=2 yhat = (110+120+130+115)/4 = 118.75
    const history = pts(100, 110, 120, 130);
    const result  = movingAverage4qForecast(history, ["2021Q1", "2021Q2"]);
    expect(result[0].yhat).toBeCloseTo(115);
    expect(result[1].yhat).toBeCloseTo(118.75);
  });

  it("returns null when fewer than 4 non-null values", () => {
    const result = movingAverage4qForecast(pts(10, 20, 30), ["2020Q4"]);
    expect(result[0].yhat).toBeNull();
  });

  it("skips nulls in history and still averages the last 4 non-null", () => {
    // 5 values with 1 null → last 4 non-null = [10, 20, 30, 40]
    const history = pts(null, 10, 20, 30, 40);
    const result  = movingAverage4qForecast(history, ["2021Q2"]);
    expect(result[0].yhat).toBeCloseTo(25);
  });
});

// ─── E. Linear trend forecast ─────────────────────────────────────────────────

describe("linearTrendForecast (E)", () => {
  it("produces an increasing forecast for a perfectly increasing series", () => {
    // y = 10 + 5*t for t = 0..7
    const history = pts(10, 15, 20, 25, 30, 35, 40, 45);
    const result  = linearTrendForecast(history, ["2022Q1", "2022Q2"]);
    // At t=8: 10 + 5*8 = 50; at t=9: 55
    expect(result[0].yhat).toBeCloseTo(50);
    expect(result[1].yhat).toBeCloseTo(55);
    expect(result[1].yhat!).toBeGreaterThan(result[0].yhat!);
  });

  it("returns null for fewer than 2 non-null observations", () => {
    const result = linearTrendForecast(pts(null, 5), ["2020Q2"]);
    expect(result[0].yhat).toBeNull();
  });

  it("extrapolates correctly for a flat series", () => {
    // Slope = 0, intercept = 50
    const history = pts(50, 50, 50, 50, 50, 50, 50, 50);
    const result  = linearTrendForecast(history, ["2022Q1"]);
    expect(result[0].yhat).toBeCloseTo(50);
  });

  it("handles a series with some nulls by using only non-null points", () => {
    // Non-null: indices 0→10, 2→20 (t=0,t=1) → slope=10, intercept=10
    // Predict at t=2 (3rd point): 10 + 10*2 = 30
    const history = [
      { period: "2020Q1", value: 10 },
      { period: "2020Q2", value: null },
      { period: "2020Q3", value: 20 },
    ];
    const result = linearTrendForecast(history, ["2020Q4"]);
    expect(result[0].yhat).toBeCloseTo(30);
  });
});

// ─── fitOLS helper ────────────────────────────────────────────────────────────

describe("fitOLS", () => {
  it("fits slope and intercept correctly", () => {
    const obs = [{ t: 0, y: 10 }, { t: 1, y: 15 }, { t: 2, y: 20 }];
    const fit = fitOLS(obs);
    expect(fit).not.toBeNull();
    expect(fit!.b).toBeCloseTo(5);
    expect(fit!.a).toBeCloseTo(10);
  });

  it("returns null for fewer than 2 observations", () => {
    expect(fitOLS([{ t: 0, y: 10 }])).toBeNull();
    expect(fitOLS([])).toBeNull();
  });

  it("returns null for degenerate (all same t)", () => {
    expect(fitOLS([{ t: 1, y: 5 }, { t: 1, y: 10 }])).toBeNull();
  });
});
