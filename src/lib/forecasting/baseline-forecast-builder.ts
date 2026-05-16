// Builds a BaselineForecastCache from a TickerTimeSeriesCache using pure
// TypeScript baseline models. No network calls, no Python, no ML dependencies.

import type { TickerTimeSeriesCache, FinancialTimeSeries } from "./time-series-types";
import type {
  BaselineForecastCache,
  BaselineModelName,
  ForecastMetric,
  ForecastPoint,
  MetricForecastResult,
  ModelBacktestResult,
} from "./forecast-types";
import { MODEL_MIN_OBS } from "./baseline-models";
import {
  naiveForecast,
  seasonalNaiveForecast,
  movingAverage4qForecast,
  linearTrendForecast,
} from "./baseline-models";
import { backtestModel, selectBestModel } from "./backtest";
import { generateFuturePeriods } from "./period-utils";
import { computeForecastQuality } from "./forecast-quality";

// --- Config -------------------------------------------------------------------

export type BaselineForecastOptions = {
  horizonQuarters?: number;
};

const DEFAULT_HORIZON = 8;

const FORECAST_METRICS: ReadonlyArray<ForecastMetric> = [
  "revenue",
  "ebit",
  "netIncome",
  "operatingCashFlow",
  "freeCashFlow",
  "ebitMargin",
  "netMargin",
  "freeCashFlowMargin",
];

const METRIC_META: Record<ForecastMetric, { label: string; unit: "BRL_BILLION" | "PERCENTAGE" | "RATIO" }> = {
  revenue:            { label: "Receita líquida",             unit: "BRL_BILLION" },
  ebit:               { label: "EBIT",                        unit: "BRL_BILLION" },
  netIncome:          { label: "Lucro líquido",               unit: "BRL_BILLION" },
  operatingCashFlow:  { label: "Fluxo de caixa operacional",  unit: "BRL_BILLION" },
  freeCashFlow:       { label: "Free cash flow",              unit: "BRL_BILLION" },
  ebitMargin:         { label: "Margem EBIT",                 unit: "PERCENTAGE"  },
  netMargin:          { label: "Margem líquida",              unit: "PERCENTAGE"  },
  freeCashFlowMargin: { label: "Margem FCL",                  unit: "PERCENTAGE"  },
};

const ALL_MODELS: ReadonlyArray<BaselineModelName> = [
  "naive",
  "seasonal_naive",
  "moving_average_4q",
  "linear_trend",
];

const MODEL_DISPATCH: Record<
  BaselineModelName,
  (history: Array<{ period: string; value: number | null }>, futurePeriods: string[]) => ForecastPoint[]
> = {
  naive:             naiveForecast,
  seasonal_naive:    seasonalNaiveForecast,
  moving_average_4q: movingAverage4qForecast,
  linear_trend:      linearTrendForecast,
};

// --- Prediction interval helper ----------------------------------------------

const BAND_MIN   = 0.10;
const BAND_MAX   = 0.75;
const NEAR_ZERO  = 1e-9;

function applyIntervals(
  points: ForecastPoint[],
  wape: number | null,
  mae: number | null,
): ForecastPoint[] {
  return points.map(p => {
    if (p.yhat === null) return p;

    let lower: number | null = null;
    let upper: number | null = null;

    if (wape !== null) {
      const band = Math.min(Math.max(wape, BAND_MIN), BAND_MAX);
      const absYhat = Math.abs(p.yhat);
      lower = p.yhat - absYhat * band;
      upper = p.yhat + absYhat * band;
    } else if (mae !== null) {
      lower = p.yhat - mae;
      upper = p.yhat + mae;
    }

    return { ...p, yhatLower: lower, yhatUpper: upper };
  });
}

// --- Current-year partial detection ------------------------------------------

function isPartialCurrentYear(period: string): boolean {
  try {
    const [yearStr, qStr] = period.split("Q");
    const year = parseInt(yearStr, 10);
    const quarter = parseInt(qStr, 10);
    const currentYear = new Date().getFullYear();
    return year === currentYear && quarter < 4;
  } catch {
    return false;
  }
}

// --- Per-metric builder ------------------------------------------------------

function buildMetricForecast(
  metric: ForecastMetric,
  series: FinancialTimeSeries,
  horizonQuarters: number,
): MetricForecastResult {
  const { label, unit } = METRIC_META[metric];
  const meta = METRIC_META[metric];

  const hasNegativeValues = series.quality.hasNegativeValues;
  const hasLargeOutliers  = series.quality.hasLargeOutliers;

  const allPoints = series.points.map(p => ({ period: p.period, value: p.value }));
  const nonNullPoints = allPoints.filter(p => p.value !== null);
  const totalObs = nonNullPoints.length;

  // Last non-null observation.
  const lastObservedPeriod = nonNullPoints.length > 0
    ? nonNullPoints[nonNullPoints.length - 1].period
    : null;

  const warnings: string[] = [];

  if (series.quality.hasNegativeValues) {
    warnings.push("Série histórica contém valores negativos.");
  }
  if (series.quality.hasLargeOutliers) {
    warnings.push("Série histórica contém potenciais outliers de grande amplitude.");
  }
  if (lastObservedPeriod && isPartialCurrentYear(lastObservedPeriod)) {
    warnings.push(`Ano corrente incompleto: último período observado é ${lastObservedPeriod}.`);
  }

  // Empty result for no data.
  if (totalObs === 0 || lastObservedPeriod === null) {
    const draft = {
      metric,
      label: meta.label,
      unit: meta.unit,
      frequency: "quarterly" as const,
      lastObservedPeriod: null,
      observations: 0,
      modelSelected: null,
      modelSelectionCriterion: "insufficient_data" as const,
      backtest: [],
      forecast: [],
      warnings: [...warnings, "Sem observações não-nulas: previsão impossível."],
      hasNegativeValues,
      hasLargeOutliers,
    };
    return { ...draft, quality: computeForecastQuality(draft) };
  }

  // Determine eligible models and run backtest for each.
  const backtestResults: ModelBacktestResult[] = [];

  for (const modelName of ALL_MODELS) {
    if (totalObs < MODEL_MIN_OBS[modelName]) continue;
    const metrics = backtestModel(modelName, allPoints);
    backtestResults.push({ model: modelName, metrics });
  }

  if (backtestResults.length === 0) {
    const draft = {
      metric,
      label: meta.label,
      unit: meta.unit,
      frequency: "quarterly" as const,
      lastObservedPeriod,
      observations: totalObs,
      modelSelected: null,
      modelSelectionCriterion: "insufficient_data" as const,
      backtest: [],
      forecast: [],
      warnings: [
        ...warnings,
        `Dados insuficientes: nenhum modelo elegível (mínimo ${MODEL_MIN_OBS.naive} observações).`,
      ],
      hasNegativeValues,
      hasLargeOutliers,
    };
    return { ...draft, quality: computeForecastQuality(draft) };
  }

  // Pre-run all eligible models and prefer those with full non-null horizon coverage.
  const futurePeriods = generateFuturePeriods(lastObservedPeriod, horizonQuarters);
  const modelForecasts = new Map<BaselineModelName, ForecastPoint[]>();
  for (const { model } of backtestResults) {
    modelForecasts.set(model, MODEL_DISPATCH[model](allPoints, futurePeriods));
  }

  const fullCoverageResults = backtestResults.filter(r =>
    modelForecasts.get(r.model)!.every(p => p.yhat !== null),
  );
  const { model: selectedModel, criterion } = fullCoverageResults.length > 0
    ? selectBestModel(fullCoverageResults)
    : selectBestModel(backtestResults);

  let forecastPoints: ForecastPoint[] = futurePeriods.map((period, i) => ({
    period,
    horizon: i + 1,
    yhat: null,
    yhatLower: null,
    yhatUpper: null,
  }));

  if (selectedModel !== null) {
    const rawPoints = modelForecasts.get(selectedModel)!;

    // Apply prediction intervals using selected model's backtest metrics.
    const selectedBacktest = backtestResults.find(r => r.model === selectedModel)!;
    const { wape, mae } = selectedBacktest.metrics;
    forecastPoints = applyIntervals(rawPoints, wape, mae);

    if (forecastPoints.some(p => p.yhat !== null)) {
      warnings.push(
        "Intervalos de incerteza são bandas heurísticas baseadas no erro de retroteste, " +
        "não intervalos de confiança estatísticos.",
      );
    }
  }

  const draft = {
    metric,
    label: meta.label,
    unit: meta.unit,
    frequency: "quarterly" as const,
    lastObservedPeriod,
    observations: totalObs,
    modelSelected: selectedModel,
    modelSelectionCriterion: criterion,
    backtest: backtestResults,
    forecast: forecastPoints,
    warnings,
    hasNegativeValues,
    hasLargeOutliers,
  };
  return { ...draft, quality: computeForecastQuality(draft) };
}

// --- Main builder ------------------------------------------------------------

export function buildBaselineForecastCache(
  timeSeriesCache: TickerTimeSeriesCache,
  options: BaselineForecastOptions = {},
): BaselineForecastCache {
  const horizonQuarters = options.horizonQuarters ?? DEFAULT_HORIZON;
  const { ticker, companyName } = timeSeriesCache;

  const seriesByMetric = new Map<string, FinancialTimeSeries>(
    timeSeriesCache.series.map(s => [s.metric, s]),
  );

  const forecasts: MetricForecastResult[] = [];
  const globalWarnings: string[] = [];

  for (const metric of FORECAST_METRICS) {
    const series = seriesByMetric.get(metric);
    if (!series) {
      // Metric not present in the time-series cache; skip.
      globalWarnings.push(`Métrica "${metric}" não encontrada na série temporal.`);
      continue;
    }
    forecasts.push(buildMetricForecast(metric, series, horizonQuarters));
  }

  const metricsWithForecast = forecasts.filter(f => f.forecast.some(p => p.yhat !== null)).length;
  if (metricsWithForecast === 0) {
    globalWarnings.push("Nenhuma métrica pôde ser prevista com os dados disponíveis.");
  }

  return {
    ticker,
    companyName,
    source: "baseline_forecast_cache",
    generatedAt: new Date().toISOString(),
    inputSource: "normalized_financial_time_series",
    horizonQuarters,
    forecasts,
    warnings: globalWarnings,
  };
}
