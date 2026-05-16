import type { MetricForecastResult, ForecastMetric } from "./forecast-types";

export function fmtForecastValue(
  value: number | null,
  unit: "BRL_BILLION" | "PERCENTAGE" | "RATIO",
): string {
  if (value === null) return "—";
  if (unit === "BRL_BILLION") return `R$ ${value.toFixed(2).replace(".", ",")} bi`;
  if (unit === "PERCENTAGE") return `${(value * 100).toFixed(1).replace(".", ",")}%`;
  return value.toFixed(3).replace(".", ",");
}

export function fmtAxisLabel(value: number, unit: "BRL_BILLION" | "PERCENTAGE" | "RATIO"): string {
  if (unit === "BRL_BILLION") {
    const abs = Math.abs(value);
    const label = abs >= 100 ? value.toFixed(0) : abs >= 10 ? value.toFixed(1) : value.toFixed(2);
    return `${label}B`;
  }
  if (unit === "PERCENTAGE") return `${(value * 100).toFixed(0)}%`;
  return value.toFixed(2);
}

export function fmtBacktestPct(value: number | null): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(1).replace(".", ",")}%`;
}

// Default metric is revenue when available; otherwise the first metric with a forecast;
// otherwise the first metric in the list.
export function selectDefaultMetric(forecasts: MetricForecastResult[]): ForecastMetric | null {
  if (forecasts.length === 0) return null;
  if (forecasts.some(f => f.metric === "revenue")) return "revenue";
  const withForecast = forecasts.find(f => f.modelSelected !== null);
  if (withForecast) return withForecast.metric;
  return forecasts[0].metric;
}
