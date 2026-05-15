import type { QuarterlyFinancialRecord } from "@/lib/cvm/types";
import type {
  FinancialSeriesMetric,
  FinancialTimeSeries,
  FinancialTimeSeriesPoint,
  TickerTimeSeriesCache,
} from "./time-series-types";

export type TimeSeriesBuilderInput = {
  ticker: string;
  companyName: string;
  quarterly: QuarterlyFinancialRecord[];
};

type RawMetricKey = Extract<
  FinancialSeriesMetric,
  keyof QuarterlyFinancialRecord
>;

const RAW_METRICS: ReadonlyArray<RawMetricKey> = [
  "revenue",
  "ebit",
  "netIncome",
  "operatingCashFlow",
  "capex",
  "freeCashFlow",
  "cash",
  "totalDebt",
  "netDebt",
] as const;

const METRIC_META: Record<
  FinancialSeriesMetric,
  { label: string; unit: "BRL_BILLION" | "PERCENTAGE" | "RATIO" }
> = {
  revenue:            { label: "Receita líquida",                  unit: "BRL_BILLION" },
  ebit:               { label: "EBIT",                             unit: "BRL_BILLION" },
  netIncome:          { label: "Lucro líquido",                    unit: "BRL_BILLION" },
  operatingCashFlow:  { label: "Fluxo de caixa operacional",       unit: "BRL_BILLION" },
  capex:              { label: "Capex",                            unit: "BRL_BILLION" },
  freeCashFlow:       { label: "Free cash flow",                   unit: "BRL_BILLION" },
  cash:               { label: "Caixa e equivalentes",             unit: "BRL_BILLION" },
  totalDebt:          { label: "Dívida total",                     unit: "BRL_BILLION" },
  netDebt:            { label: "Dívida líquida",                   unit: "BRL_BILLION" },
  ebitMargin:         { label: "Margem EBIT",                      unit: "PERCENTAGE"  },
  netMargin:          { label: "Margem líquida",                   unit: "PERCENTAGE"  },
  freeCashFlowMargin: { label: "Margem FCL",                       unit: "PERCENTAGE"  },
  revenueYoYGrowth:   { label: "Crescimento receita (YoY)",        unit: "PERCENTAGE"  },
  ebitYoYGrowth:      { label: "Crescimento EBIT (YoY)",           unit: "PERCENTAGE"  },
  netIncomeYoYGrowth: { label: "Crescimento lucro líquido (YoY)",  unit: "PERCENTAGE"  },
};

// 0.0001 BRL billion ≈ 100k BRL — treated as "near zero" for outlier detection denominator
const NEAR_ZERO_THRESHOLD = 1e-4;

function sortRecords(
  quarterly: QuarterlyFinancialRecord[],
): QuarterlyFinancialRecord[] {
  return [...quarterly].sort((a, b) =>
    a.fiscalYear !== b.fiscalYear
      ? a.fiscalYear - b.fiscalYear
      : a.quarter - b.quarter,
  );
}

function computeQuality(
  points: FinancialTimeSeriesPoint[],
): FinancialTimeSeries["quality"] {
  const nonNullPoints = points.filter(
    (p): p is FinancialTimeSeriesPoint & { value: number } => p.value !== null,
  );

  const observations = nonNullPoints.length;
  const missing = points.length - observations;
  const startPeriod = nonNullPoints.length > 0 ? nonNullPoints[0].period : null;
  const endPeriod =
    nonNullPoints.length > 0
      ? nonNullPoints[nonNullPoints.length - 1].period
      : null;

  const hasNegativeValues = nonNullPoints.some((p) => p.value < 0);

  let hasLargeOutliers = false;
  for (let i = 1; i < points.length && !hasLargeOutliers; i++) {
    const curr = points[i].value;
    const prev = points[i - 1].value;
    if (curr === null || prev === null) continue;
    const absPrev = Math.abs(prev);
    if (absPrev < NEAR_ZERO_THRESHOLD) continue;
    if (Math.abs((curr - prev) / prev) > 5.0) {
      hasLargeOutliers = true;
    }
  }

  return { observations, missing, startPeriod, endPeriod, hasNegativeValues, hasLargeOutliers };
}

function buildRawSeries(
  sorted: QuarterlyFinancialRecord[],
  metric: RawMetricKey,
): FinancialTimeSeries {
  const meta = METRIC_META[metric];
  const points: FinancialTimeSeriesPoint[] = sorted.map((r) => ({
    period: r.period,
    periodEndDate: r.periodEndDate,
    value: (r[metric] as number | null),
    source: r.source,
  }));
  return {
    metric,
    label: meta.label,
    unit: meta.unit,
    frequency: "quarterly",
    points,
    quality: computeQuality(points),
  };
}

function buildMarginSeries(
  sorted: QuarterlyFinancialRecord[],
  metric: FinancialSeriesMetric,
  numeratorKey: "ebit" | "netIncome" | "freeCashFlow",
): FinancialTimeSeries {
  const meta = METRIC_META[metric];
  const points: FinancialTimeSeriesPoint[] = sorted.map((r) => {
    const num = r[numeratorKey];
    const denom = r.revenue;
    const value =
      num !== null && denom !== null && denom > 0 ? num / denom : null;
    return { period: r.period, periodEndDate: r.periodEndDate, value, source: "derived" };
  });
  return {
    metric,
    label: meta.label,
    unit: meta.unit,
    frequency: "quarterly",
    points,
    quality: computeQuality(points),
  };
}

function buildYoYSeries(
  sorted: QuarterlyFinancialRecord[],
  metric: FinancialSeriesMetric,
  valueKey: "revenue" | "ebit" | "netIncome",
): FinancialTimeSeries {
  const meta = METRIC_META[metric];

  const lookup = new Map<string, number | null>();
  for (const r of sorted) {
    lookup.set(`${r.fiscalYear}:${r.quarter}`, r[valueKey]);
  }

  const points: FinancialTimeSeriesPoint[] = sorted.map((r) => {
    const curr = r[valueKey];
    const lagKey = `${r.fiscalYear - 1}:${r.quarter}`;
    let value: number | null = null;
    if (lookup.has(lagKey)) {
      const lag = lookup.get(lagKey)!;
      if (curr !== null && lag !== null && lag !== 0) {
        value = curr / lag - 1;
      }
    }
    return { period: r.period, periodEndDate: r.periodEndDate, value, source: "derived" };
  });

  return {
    metric,
    label: meta.label,
    unit: meta.unit,
    frequency: "quarterly",
    points,
    quality: computeQuality(points),
  };
}

export function buildTickerTimeSeriesCache(
  input: TimeSeriesBuilderInput,
): TickerTimeSeriesCache {
  const sorted = sortRecords(input.quarterly);
  const series: FinancialTimeSeries[] = [];
  const warnings: string[] = [];

  for (const metric of RAW_METRICS) {
    series.push(buildRawSeries(sorted, metric));
  }

  series.push(buildMarginSeries(sorted, "ebitMargin", "ebit"));
  series.push(buildMarginSeries(sorted, "netMargin", "netIncome"));
  series.push(buildMarginSeries(sorted, "freeCashFlowMargin", "freeCashFlow"));

  series.push(buildYoYSeries(sorted, "revenueYoYGrowth", "revenue"));
  series.push(buildYoYSeries(sorted, "ebitYoYGrowth", "ebit"));
  series.push(buildYoYSeries(sorted, "netIncomeYoYGrowth", "netIncome"));

  for (const s of series) {
    if (s.quality.hasLargeOutliers) {
      warnings.push(
        `Série "${s.label}" contém variações trimestrais superiores a 500% — verifique possíveis outliers.`,
      );
    }
    if (s.quality.observations === 0) {
      warnings.push(`Série "${s.label}" não possui nenhum valor não-nulo.`);
    }
  }

  if (sorted.length < 8) {
    warnings.push(
      `Histórico trimestral curto (${sorted.length} trimestres). Séries YoY podem ser escassas.`,
    );
  }

  return {
    ticker: input.ticker,
    companyName: input.companyName,
    source: "normalized_financial_time_series",
    generatedAt: new Date().toISOString(),
    inputSource: "cvm_itr_quarterly_cache",
    series,
    warnings,
  };
}
