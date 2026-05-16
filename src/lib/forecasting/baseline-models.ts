// Pure baseline forecasting models. Each function accepts a history array and
// future period labels, returning ForecastPoint[] with null interval bounds
// (intervals are applied by the builder after backtest-derived error estimation).

import type { ForecastPoint } from "./forecast-types";
import { parseQuarterPeriod } from "./period-utils";

type HistoricalPoint = { period: string; value: number | null };

// Minimum non-null historical observations required per model.
export const MODEL_MIN_OBS = {
  naive:             1,
  seasonal_naive:    8,
  moving_average_4q: 4,
  linear_trend:      8,
} as const;

// --- OLS helper (exported for backtest reuse) ---------------------------------

export type OLSResult = { a: number; b: number };

export function fitOLS(obs: ReadonlyArray<{ t: number; y: number }>): OLSResult | null {
  const n = obs.length;
  if (n < 2) return null;
  let sumT = 0, sumY = 0, sumTY = 0, sumT2 = 0;
  for (const { t, y } of obs) {
    sumT  += t;
    sumY  += y;
    sumTY += t * y;
    sumT2 += t * t;
  }
  const denom = n * sumT2 - sumT * sumT;
  if (Math.abs(denom) < 1e-12) return null;
  const b = (n * sumTY - sumT * sumY) / denom;
  const a = (sumY - b * sumT) / n;
  return { a, b };
}

// --- Model functions ---------------------------------------------------------

function point(period: string, horizon: number, yhat: number | null): ForecastPoint {
  return { period, horizon, yhat, yhatLower: null, yhatUpper: null };
}

export function naiveForecast(
  history: HistoricalPoint[],
  futurePeriods: string[],
): ForecastPoint[] {
  const lastNonNull = [...history].reverse().find(p => p.value !== null);
  const yhat = lastNonNull?.value ?? null;
  return futurePeriods.map((period, i) => point(period, i + 1, yhat));
}

export function seasonalNaiveForecast(
  history: HistoricalPoint[],
  futurePeriods: string[],
): ForecastPoint[] {
  // Build period → value lookup from non-null history.
  const lookup = new Map<string, number>();
  for (const p of history) {
    if (p.value !== null) lookup.set(p.period, p.value);
  }

  // Imperative loop so h > 4 can fall back recursively to result[i-4].yhat
  // when the historical lag is not yet observed (extends the seasonal pattern
  // one full year into the future without needing new historical data).
  const result: ForecastPoint[] = [];
  for (let i = 0; i < futurePeriods.length; i++) {
    const period = futurePeriods[i];
    const { year, quarter } = parseQuarterPeriod(period);
    const lagPeriod = `${year - 1}Q${quarter}`;

    let yhat: number | null;
    if (lookup.has(lagPeriod)) {
      yhat = lookup.get(lagPeriod) as number;
    } else if (i >= 4 && result[i - 4].yhat !== null) {
      yhat = result[i - 4].yhat;
    } else {
      yhat = null;
    }
    result.push(point(period, i + 1, yhat));
  }
  return result;
}

export function movingAverage4qForecast(
  history: HistoricalPoint[],
  futurePeriods: string[],
): ForecastPoint[] {
  // Seed the rolling buffer with the last 4 non-null historical values.
  // For h>1, previous forecasts (if non-null) are pushed into the buffer.
  const buf: number[] = history
    .filter(p => p.value !== null)
    .map(p => p.value as number)
    .slice(-4);

  const result: ForecastPoint[] = [];
  for (let i = 0; i < futurePeriods.length; i++) {
    if (buf.length < 4) {
      result.push(point(futurePeriods[i], i + 1, null));
      continue;
    }
    const yhat = buf.reduce((s, v) => s + v, 0) / buf.length;
    result.push(point(futurePeriods[i], i + 1, yhat));
    buf.shift();
    buf.push(yhat);
  }
  return result;
}

export function linearTrendForecast(
  history: HistoricalPoint[],
  futurePeriods: string[],
): ForecastPoint[] {
  const nonNull = history
    .filter(p => p.value !== null)
    .map((p, i) => ({ t: i, y: p.value as number }));

  const fit = fitOLS(nonNull);
  const nullForecast = futurePeriods.map((period, i) => point(period, i + 1, null));
  if (!fit) return nullForecast;

  const n = nonNull.length;
  const { a, b } = fit;
  return futurePeriods.map((period, i) => point(period, i + 1, a + b * (n + i)));
}
