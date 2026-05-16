export type BaselineModelName =
  | "naive"
  | "seasonal_naive"
  | "moving_average_4q"
  | "linear_trend";

export type ForecastMetric =
  | "revenue"
  | "ebit"
  | "netIncome"
  | "operatingCashFlow"
  | "freeCashFlow"
  | "ebitMargin"
  | "netMargin"
  | "freeCashFlowMargin";

export type ForecastPoint = {
  period: string;
  horizon: number;
  yhat: number | null;
  yhatLower: number | null;
  yhatUpper: number | null;
};

export type BacktestMetrics = {
  observations: number;
  trainObservations: number;
  testObservations: number;
  mae: number | null;
  rmse: number | null;
  mape: number | null;
  smape: number | null;
  wape: number | null;
};

export type ModelBacktestResult = {
  model: BaselineModelName;
  metrics: BacktestMetrics;
};

export type MetricForecastResult = {
  metric: ForecastMetric;
  label: string;
  unit: "BRL_BILLION" | "PERCENTAGE" | "RATIO";
  frequency: "quarterly";
  lastObservedPeriod: string | null;
  observations: number;
  modelSelected: BaselineModelName | null;
  modelSelectionCriterion: "lowest_wape_then_smape" | "insufficient_data";
  backtest: ModelBacktestResult[];
  forecast: ForecastPoint[];
  warnings: string[];
};

export type BaselineForecastCache = {
  ticker: string;
  companyName: string;
  source: "baseline_forecast_cache";
  generatedAt: string;
  inputSource: "normalized_financial_time_series";
  horizonQuarters: number;
  forecasts: MetricForecastResult[];
  warnings: string[];
};
