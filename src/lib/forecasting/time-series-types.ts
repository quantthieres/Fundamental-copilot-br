export type FinancialSeriesMetric =
  | "revenue"
  | "ebit"
  | "netIncome"
  | "operatingCashFlow"
  | "capex"
  | "freeCashFlow"
  | "cash"
  | "totalDebt"
  | "netDebt"
  | "ebitMargin"
  | "netMargin"
  | "freeCashFlowMargin"
  | "revenueYoYGrowth"
  | "ebitYoYGrowth"
  | "netIncomeYoYGrowth";

export type FinancialTimeSeriesPoint = {
  period: string;
  periodEndDate: string;
  value: number | null;
  source: "cvm_itr" | "cvm_dfp_derived_q4" | "derived";
};

export type FinancialTimeSeries = {
  metric: FinancialSeriesMetric;
  label: string;
  unit: "BRL_BILLION" | "PERCENTAGE" | "RATIO";
  frequency: "quarterly";
  points: FinancialTimeSeriesPoint[];
  quality: {
    observations: number;
    missing: number;
    startPeriod: string | null;
    endPeriod: string | null;
    hasNegativeValues: boolean;
    hasLargeOutliers: boolean;
  };
};

export type TickerTimeSeriesCache = {
  ticker: string;
  companyName: string;
  source: "normalized_financial_time_series";
  generatedAt: string;
  inputSource: "cvm_itr_quarterly_cache";
  series: FinancialTimeSeries[];
  warnings: string[];
};
