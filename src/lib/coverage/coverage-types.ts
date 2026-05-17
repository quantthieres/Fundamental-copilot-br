export type AssetType =
  | "common_stock"
  | "preferred_stock"
  | "unit"
  | "bank"
  | "insurance"
  | "financial"
  | "fii"
  | "etf"
  | "bdr"
  | "fund"
  | "unknown";

export type AnalysisCoverageLevel =
  | "full_analysis"
  | "cvm_analysis"
  | "cvm_financials"
  | "quote_only"
  | "sector_specific_model_required"
  | "unavailable";

export type CoverageReasonCode =
  | "HAS_FULL_CVM_AND_FORECAST"
  | "HAS_CVM_FINANCIALS"
  | "HAS_CVM_BUT_LIMITED_METRICS"
  | "QUOTE_ONLY"
  | "BANK_MODEL_REQUIRED"
  | "INSURANCE_MODEL_REQUIRED"
  | "FII_MODEL_REQUIRED"
  | "ETF_MODEL_REQUIRED"
  | "BDR_MODEL_REQUIRED"
  | "NO_CVM_MAPPING"
  | "NO_MARKET_DATA"
  | "UNKNOWN_ASSET_TYPE";

export type AssetCoverageProfile = {
  ticker: string;
  normalizedTicker: string;
  assetType: AssetType;
  coverageLevel: AnalysisCoverageLevel;
  reasonCode: CoverageReasonCode;
  displayTitle: string;
  displayMessage: string;
  hasMarketData: boolean;
  hasCvmCompany: boolean;
  hasAnnualFinancials: boolean;
  hasQuarterlyFinancials: boolean;
  hasTimeSeries: boolean;
  hasBaselineForecast: boolean;
  isForecastEligible: boolean;
  isIndustrialModelEligible: boolean;
};
