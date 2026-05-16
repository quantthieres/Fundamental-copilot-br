// Walk-forward backtesting for baseline models. Each model is evaluated with
// one-step-ahead predictions over a rolling test window.

import type { BaselineModelName, BacktestMetrics, ModelBacktestResult } from "./forecast-types";
import { parseQuarterPeriod } from "./period-utils";
import { fitOLS } from "./baseline-models";

type ObservedPoint = { period: string; value: number };

// Minimum training observations required per model before a one-step prediction
// is attempted at each test step.
const TRAIN_MIN: Record<BaselineModelName, number> = {
  naive:             1,
  seasonal_naive:    4,  // need at least one year of history for any seasonal lag
  moving_average_4q: 4,
  linear_trend:      2,  // need at least 2 points for OLS
};

// Default test window.
const DEFAULT_TEST_MAX = 8;

// --- One-step-ahead predictors -----------------------------------------------

function naiveStep(train: ObservedPoint[]): number | null {
  return train.length > 0 ? train[train.length - 1].value : null;
}

function seasonalNaiveStep(train: ObservedPoint[], targetPeriod: string): number | null {
  const { year, quarter } = parseQuarterPeriod(targetPeriod);
  const lagPeriod = `${year - 1}Q${quarter}`;
  return train.find(p => p.period === lagPeriod)?.value ?? null;
}

function movingAverage4qStep(train: ObservedPoint[]): number | null {
  if (train.length < 4) return null;
  const last4 = train.slice(-4);
  return last4.reduce((s, p) => s + p.value, 0) / 4;
}

function linearTrendStep(train: ObservedPoint[]): number | null {
  if (train.length < 2) return null;
  const obs = train.map((p, i) => ({ t: i, y: p.value }));
  const fit = fitOLS(obs);
  if (!fit) return null;
  return fit.a + fit.b * train.length;
}

function predictOneStep(
  modelName: BaselineModelName,
  train: ObservedPoint[],
  targetPeriod: string,
): number | null {
  switch (modelName) {
    case "naive":             return naiveStep(train);
    case "seasonal_naive":    return seasonalNaiveStep(train, targetPeriod);
    case "moving_average_4q": return movingAverage4qStep(train);
    case "linear_trend":      return linearTrendStep(train);
  }
}

// --- Error metrics -----------------------------------------------------------

const NEAR_ZERO = 1e-9;

function computeMetrics(
  pairs: Array<{ actual: number; predicted: number }>,
): Pick<BacktestMetrics, "mae" | "rmse" | "mape" | "smape" | "wape"> {
  if (pairs.length === 0) {
    return { mae: null, rmse: null, mape: null, smape: null, wape: null };
  }

  let sumAE = 0, sumSE = 0, sumAPE = 0, smapeSum = 0, wapeNum = 0, wapeDen = 0;
  let anyActualNearZero = false;

  for (const { actual, predicted } of pairs) {
    const err = actual - predicted;
    const absErr = Math.abs(err);
    const absActual = Math.abs(actual);

    sumAE  += absErr;
    sumSE  += err * err;
    wapeNum += absErr;
    wapeDen += absActual;

    if (absActual < NEAR_ZERO) anyActualNearZero = true;
    sumAPE += absActual < NEAR_ZERO ? 0 : absErr / absActual;

    const smapeDenom = absActual + Math.abs(predicted);
    smapeSum += smapeDenom < NEAR_ZERO ? 0 : 2 * absErr / smapeDenom;
  }

  const n = pairs.length;
  const mae  = sumAE / n;
  const rmse = Math.sqrt(sumSE / n);
  const mape = anyActualNearZero ? null : sumAPE / n;
  const smape = smapeSum / n;
  const wape = wapeDen < NEAR_ZERO ? null : wapeNum / wapeDen;

  return { mae, rmse, mape, smape, wape };
}

// --- Main backtest function --------------------------------------------------

export function backtestModel(
  modelName: BaselineModelName,
  allPoints: ReadonlyArray<{ period: string; value: number | null }>,
  testMax = DEFAULT_TEST_MAX,
): BacktestMetrics {
  const obs: ObservedPoint[] = allPoints
    .filter((p): p is ObservedPoint => p.value !== null)
    .map(p => ({ period: p.period, value: p.value }));

  const trainMin = TRAIN_MIN[modelName];
  const totalObs = obs.length;

  const testSize = Math.max(0, Math.min(testMax, totalObs - trainMin));
  if (testSize === 0) {
    return {
      observations:      totalObs,
      trainObservations: totalObs,
      testObservations:  0,
      mae: null, rmse: null, mape: null, smape: null, wape: null,
    };
  }

  const testStart = totalObs - testSize;

  const pairs: Array<{ actual: number; predicted: number }> = [];
  for (let i = testStart; i < totalObs; i++) {
    const train = obs.slice(0, i);
    if (train.length < trainMin) continue;
    const pred = predictOneStep(modelName, train, obs[i].period);
    if (pred !== null) {
      pairs.push({ actual: obs[i].value, predicted: pred });
    }
  }

  return {
    observations:      totalObs,
    trainObservations: testStart,
    testObservations:  testSize,
    ...computeMetrics(pairs),
  };
}

// --- Model selection ---------------------------------------------------------

export function selectBestModel(
  results: ModelBacktestResult[],
): { model: BaselineModelName | null; criterion: "lowest_wape_then_smape" | "insufficient_data" } {
  const withWape = results.filter(r => r.metrics.wape !== null);
  if (withWape.length > 0) {
    const best = withWape.reduce((a, b) =>
      (a.metrics.wape as number) <= (b.metrics.wape as number) ? a : b,
    );
    return { model: best.model, criterion: "lowest_wape_then_smape" };
  }

  const withSmape = results.filter(r => r.metrics.smape !== null);
  if (withSmape.length > 0) {
    const best = withSmape.reduce((a, b) =>
      (a.metrics.smape as number) <= (b.metrics.smape as number) ? a : b,
    );
    return { model: best.model, criterion: "lowest_wape_then_smape" };
  }

  return { model: null, criterion: "insufficient_data" };
}
