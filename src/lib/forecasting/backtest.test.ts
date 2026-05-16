import { describe, it, expect } from "vitest";
import { backtestModel, selectBestModel } from "./backtest";
import type { ModelBacktestResult } from "./forecast-types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pts(...values: (number | null)[]): Array<{ period: string; value: number | null }> {
  return values.map((v, i) => {
    const year = 2020 + Math.floor(i / 4);
    const q    = (i % 4) + 1;
    return { period: `${year}Q${q}`, value: v };
  });
}

// ─── F. Backtest metrics ──────────────────────────────────────────────────────

describe("backtestModel — MAE and RMSE (F)", () => {
  it("naive one-step: errors are predictable for a constant series", () => {
    // Series: 10,10,10,...,10 (10 points). Naive always predicts the prior value.
    // All predictions = 10, actuals = 10, so all errors = 0.
    const series = pts(10, 10, 10, 10, 10, 10, 10, 10, 10, 10);
    const result = backtestModel("naive", series);
    expect(result.mae).toBeCloseTo(0);
    expect(result.rmse).toBeCloseTo(0);
    expect(result.wape).toBeCloseTo(0);
  });

  it("naive: MAE is average absolute error", () => {
    // 10-point series: 1..10. Test on last 8 (indices 2..9), train starts at 2+ obs.
    // naive pred at i = obs[i-1].value. Errors = 1 for each step.
    const series = pts(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
    const result = backtestModel("naive", series);
    expect(result.mae).toBeCloseTo(1);
    expect(result.rmse).toBeCloseTo(1);
  });

  it("WAPE computed correctly", () => {
    // 10-point constant series: actuals=10, errors=0 → WAPE=0
    const series = pts(10, 10, 10, 10, 10, 10, 10, 10, 10, 10);
    const result = backtestModel("naive", series);
    expect(result.wape).toBeCloseTo(0);
  });

  it("WAPE = sum(|errors|) / sum(|actuals|)", () => {
    // Naive on [1,2,3,4,5,6,7,8,9,10]:
    // errors = all 1 (since pred = prev). test window = last 8.
    // actuals = [3,4,5,6,7,8,9,10], preds = [2,3,4,5,6,7,8,9]
    // sum(|errors|) = 8, sum(|actuals|) = 3+4+5+6+7+8+9+10 = 52
    // WAPE = 8/52 ≈ 0.1538
    const series = pts(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
    const result = backtestModel("naive", series);
    expect(result.wape).toBeCloseTo(8 / 52, 4);
  });
});

describe("backtestModel — MAPE null when actual contains zero (F)", () => {
  it("MAPE is null when any actual in the test window is zero", () => {
    // Series with a zero at a test-window position
    const series = pts(1, 2, 3, 4, 5, 6, 7, 8, 9, 0);
    const result = backtestModel("naive", series);
    expect(result.mape).toBeNull();
  });

  it("MAPE is non-null when all test-window actuals are non-zero", () => {
    const series = pts(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
    const result = backtestModel("naive", series);
    expect(result.mape).not.toBeNull();
  });
});

describe("backtestModel — insufficient data (F)", () => {
  it("returns all-null metrics when fewer than trainMin+1 observations", () => {
    // linear_trend needs trainMin=2 so needs >=3 total for 1 test step.
    const series = pts(10, 20); // only 2 non-null → testSize = max(0, 2-2) = 0
    const result = backtestModel("linear_trend", series);
    expect(result.testObservations).toBe(0);
    expect(result.mae).toBeNull();
    expect(result.wape).toBeNull();
  });

  it("returns observations equal to total non-null points", () => {
    const series = pts(null, 10, null, 20, 30);
    const result = backtestModel("naive", series);
    expect(result.observations).toBe(3);
  });
});

describe("backtestModel — moving_average_4q (F)", () => {
  it("needs at least 4 training points before prediction", () => {
    // 5 obs, trainMin=4, testMax=8 → testSize = min(8, 5-4) = 1
    const series = pts(10, 20, 30, 40, 50);
    const result = backtestModel("moving_average_4q", series);
    expect(result.testObservations).toBe(1);
    // pred for obs[4]=50: mean(10,20,30,40)=25; error=25; MAE=25
    expect(result.mae).toBeCloseTo(25);
  });
});

describe("backtestModel — seasonal_naive (F)", () => {
  it("handles seasonal lag correctly in the backtest window", () => {
    // 8 quarters of history (2020Q1..2021Q4), trainMin=4
    const series = [
      { period: "2020Q1", value: 10 },
      { period: "2020Q2", value: 11 },
      { period: "2020Q3", value: 12 },
      { period: "2020Q4", value: 13 },
      { period: "2021Q1", value: 14 },
      { period: "2021Q2", value: 15 },
      { period: "2021Q3", value: 16 },
      { period: "2021Q4", value: 17 },
    ];
    const result = backtestModel("seasonal_naive", series);
    // testSize = min(8, 8-4) = 4, test on [2021Q1..2021Q4]
    // Predictions: 2021Q1→2020Q1=10 (err=4), 2021Q2→11 (err=4), 2021Q3→12 (err=4), 2021Q4→13 (err=4)
    // MAE = 4
    expect(result.testObservations).toBe(4);
    expect(result.mae).toBeCloseTo(4);
  });
});

// ─── G. Model selection ───────────────────────────────────────────────────────

describe("selectBestModel (G)", () => {
  it("selects model with lowest WAPE", () => {
    const results: ModelBacktestResult[] = [
      { model: "naive",             metrics: { observations: 10, trainObservations: 2, testObservations: 8, mae: 1, rmse: 1, mape: null, smape: 0.1, wape: 0.3 } },
      { model: "moving_average_4q", metrics: { observations: 10, trainObservations: 2, testObservations: 8, mae: 1, rmse: 1, mape: null, smape: 0.08, wape: 0.2 } },
      { model: "linear_trend",      metrics: { observations: 10, trainObservations: 2, testObservations: 8, mae: 1, rmse: 1, mape: null, smape: 0.05, wape: 0.15 } },
    ];
    const { model, criterion } = selectBestModel(results);
    expect(model).toBe("linear_trend");
    expect(criterion).toBe("lowest_wape_then_smape");
  });

  it("falls back to lowest sMAPE when all WAPE are null", () => {
    const results: ModelBacktestResult[] = [
      { model: "naive",          metrics: { observations: 5, trainObservations: 1, testObservations: 4, mae: null, rmse: null, mape: null, smape: 0.20, wape: null } },
      { model: "seasonal_naive", metrics: { observations: 5, trainObservations: 1, testObservations: 4, mae: null, rmse: null, mape: null, smape: 0.10, wape: null } },
    ];
    const { model, criterion } = selectBestModel(results);
    expect(model).toBe("seasonal_naive");
    expect(criterion).toBe("lowest_wape_then_smape");
  });

  it("returns null when all metrics are null", () => {
    const results: ModelBacktestResult[] = [
      { model: "naive", metrics: { observations: 1, trainObservations: 0, testObservations: 1, mae: null, rmse: null, mape: null, smape: null, wape: null } },
    ];
    const { model, criterion } = selectBestModel(results);
    expect(model).toBeNull();
    expect(criterion).toBe("insufficient_data");
  });

  it("returns null for empty results array", () => {
    const { model, criterion } = selectBestModel([]);
    expect(model).toBeNull();
    expect(criterion).toBe("insufficient_data");
  });

  it("prefers WAPE over sMAPE even when sMAPE suggests different model", () => {
    const results: ModelBacktestResult[] = [
      { model: "naive",        metrics: { observations: 10, trainObservations: 2, testObservations: 8, mae: 1, rmse: 1, mape: null, smape: 0.05, wape: 0.20 } },
      { model: "linear_trend", metrics: { observations: 10, trainObservations: 2, testObservations: 8, mae: 1, rmse: 1, mape: null, smape: 0.50, wape: 0.10 } },
    ];
    const { model } = selectBestModel(results);
    expect(model).toBe("linear_trend"); // wins on WAPE despite worse sMAPE
  });
});
