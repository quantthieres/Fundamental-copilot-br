import type {
  AssetType,
  AnalysisCoverageLevel,
  CoverageReasonCode,
  AssetCoverageProfile,
} from "./coverage-types";
import { normalizeTicker } from "./asset-classifier";

// ─── Input ────────────────────────────────────────────────────────────────────

export type CoverageResolverInput = {
  ticker: string;
  assetType: AssetType;
  hasMarketData: boolean;
  hasCvmCompany: boolean;
  hasAnnualFinancials: boolean;
  hasQuarterlyFinancials: boolean;
  hasTimeSeries: boolean;
  hasBaselineForecast: boolean;
  companyName?: string;
  sector?: string;
};

// ─── Industrial model eligibility ─────────────────────────────────────────────

// Only operating companies (stocks and operating-company units) can use the
// standard industrial metrics pipeline. Banks, insurance, FIIs, ETFs, BDRs
// and financial holdings require sector-specific models.
const INDUSTRIAL_TYPES = new Set<AssetType>([
  "common_stock",
  "preferred_stock",
  "unit",
]);

function isIndustrialEligible(assetType: AssetType): boolean {
  return INDUSTRIAL_TYPES.has(assetType);
}

// ─── Display messages (Portuguese) ────────────────────────────────────────────

function buildDisplayMessage(reasonCode: CoverageReasonCode): string {
  switch (reasonCode) {
    case "HAS_FULL_CVM_AND_FORECAST":
      return "Dashboard completo com dados financeiros, indicadores, diagnóstico e projeções de fundamentos.";
    case "HAS_CVM_FINANCIALS":
      return "Análise fundamentalista gerada automaticamente com dados CVM suficientes.";
    case "HAS_CVM_BUT_LIMITED_METRICS":
      return "Dados financeiros da CVM disponíveis, mas com histórico insuficiente para análise completa.";
    case "QUOTE_ONLY":
    case "NO_CVM_MAPPING":
      return "Cotação de mercado disponível. Demonstrações financeiras da CVM ainda não integradas para este ativo.";
    case "BANK_MODEL_REQUIRED":
      return "Este ativo exige modelo específico para instituições financeiras.";
    case "INSURANCE_MODEL_REQUIRED":
      return "Este ativo exige modelo específico para seguradoras.";
    case "FII_MODEL_REQUIRED":
      return "Este ativo exige modelo específico para fundos imobiliários.";
    case "ETF_MODEL_REQUIRED":
      return "Este ativo representa um fundo/índice e não utiliza demonstrações financeiras corporativas tradicionais.";
    case "BDR_MODEL_REQUIRED":
      return "Este ativo representa recibo de ativo estrangeiro e exige tratamento específico.";
    case "NO_MARKET_DATA":
      return "Ativo reconhecido no universo B3, mas ainda sem cobertura de dados financeiros.";
    case "UNKNOWN_ASSET_TYPE":
      return "Este ativo requer classificação específica. Métricas industriais padrão não aplicáveis.";
  }
}

// ─── Resolution logic ─────────────────────────────────────────────────────────

function resolveForNonIndustrial(
  assetType: AssetType,
): { coverageLevel: AnalysisCoverageLevel; reasonCode: CoverageReasonCode } {
  switch (assetType) {
    case "bank":
      return { coverageLevel: "sector_specific_model_required", reasonCode: "BANK_MODEL_REQUIRED" };
    case "insurance":
      return { coverageLevel: "sector_specific_model_required", reasonCode: "INSURANCE_MODEL_REQUIRED" };
    case "fii":
      return { coverageLevel: "sector_specific_model_required", reasonCode: "FII_MODEL_REQUIRED" };
    case "etf":
      return { coverageLevel: "sector_specific_model_required", reasonCode: "ETF_MODEL_REQUIRED" };
    case "bdr":
      return { coverageLevel: "sector_specific_model_required", reasonCode: "BDR_MODEL_REQUIRED" };
    default:
      return { coverageLevel: "sector_specific_model_required", reasonCode: "UNKNOWN_ASSET_TYPE" };
  }
}

function resolveForIndustrial(
  input: CoverageResolverInput,
): { coverageLevel: AnalysisCoverageLevel; reasonCode: CoverageReasonCode } {
  const {
    hasMarketData,
    hasCvmCompany,
    hasAnnualFinancials,
    hasQuarterlyFinancials,
    hasTimeSeries,
    hasBaselineForecast,
  } = input;

  if (!hasMarketData && !hasCvmCompany && !hasAnnualFinancials) {
    return { coverageLevel: "unavailable", reasonCode: "NO_MARKET_DATA" };
  }

  if (!hasCvmCompany && !hasAnnualFinancials) {
    return hasMarketData
      ? { coverageLevel: "quote_only",    reasonCode: "NO_CVM_MAPPING" }
      : { coverageLevel: "unavailable",   reasonCode: "NO_MARKET_DATA" };
  }

  if (hasAnnualFinancials) {
    // Full pipeline: all four caches present.
    if (hasQuarterlyFinancials && hasTimeSeries && hasBaselineForecast) {
      return { coverageLevel: "full_analysis", reasonCode: "HAS_FULL_CVM_AND_FORECAST" };
    }
    // Good data: annual + quarterly or time-series, but forecast pipeline incomplete.
    if (hasQuarterlyFinancials || hasTimeSeries) {
      return { coverageLevel: "cvm_analysis", reasonCode: "HAS_CVM_FINANCIALS" };
    }
    // Annual data only — limited metrics, no forecast.
    return { coverageLevel: "cvm_financials", reasonCode: "HAS_CVM_BUT_LIMITED_METRICS" };
  }

  // CVM company mapped but no data cached yet.
  if (hasCvmCompany) {
    return { coverageLevel: "cvm_financials", reasonCode: "HAS_CVM_BUT_LIMITED_METRICS" };
  }

  return { coverageLevel: "quote_only", reasonCode: "QUOTE_ONLY" };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function resolveAssetCoverage(
  input: CoverageResolverInput,
): AssetCoverageProfile {
  const normalizedTicker = normalizeTicker(input.ticker);
  const { assetType } = input;
  const industrial = isIndustrialEligible(assetType);

  const { coverageLevel, reasonCode } = industrial
    ? resolveForIndustrial(input)
    : resolveForNonIndustrial(assetType);

  const isForecastEligible =
    industrial && input.hasTimeSeries && input.hasBaselineForecast;

  return {
    ticker:               input.ticker.toUpperCase(),
    normalizedTicker,
    assetType,
    coverageLevel,
    reasonCode,
    displayTitle:         input.companyName ?? normalizedTicker,
    displayMessage:       buildDisplayMessage(reasonCode),
    hasMarketData:        input.hasMarketData,
    hasCvmCompany:        input.hasCvmCompany,
    hasAnnualFinancials:  input.hasAnnualFinancials,
    hasQuarterlyFinancials: input.hasQuarterlyFinancials,
    hasTimeSeries:        input.hasTimeSeries,
    hasBaselineForecast:  input.hasBaselineForecast,
    isForecastEligible,
    isIndustrialModelEligible: industrial,
  };
}
