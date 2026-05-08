export type CoverageStatus =
  | "full_analysis"
  | "cvm_analysis"
  | "cvm_financials"
  | "quote_only"
  | "sector_specific_model_required"
  | "unavailable";

export type AssetType =
  | "stock"    // ON, PN, or PNA/PNB ordinary/preferred share
  | "unit"     // certificate of deposit (e.g., TAEE11, BPAC11)
  | "fii"      // Fundo de Investimento Imobiliário
  | "etf"      // Exchange Traded Fund
  | "bdr"      // Brazilian Depositary Receipt
  | "unknown";

export interface CoverageBadge {
  label: string;
  bg: string;
  color: string;
}

export const COVERAGE_BADGE: Record<CoverageStatus, CoverageBadge> = {
  full_analysis:                   { label: "Análise completa",   bg: "#dcfce7", color: "#15803d" },
  cvm_analysis:                    { label: "Análise CVM",        bg: "#ede9fe", color: "#7c3aed" },
  cvm_financials:                  { label: "Dados CVM",          bg: "#dbeafe", color: "#1d4ed8" },
  quote_only:                      { label: "Cotação",            bg: "#f1f5f9", color: "#475569" },
  sector_specific_model_required:  { label: "Modelo específico",  bg: "#fef3c7", color: "#b45309" },
  unavailable:                     { label: "Em breve",           bg: "#f8fafc", color: "#94a3b8" },
};

export const COVERAGE_DESCRIPTION: Record<CoverageStatus, string> = {
  full_analysis:
    "Dashboard completo com dados financeiros, indicadores, diagnóstico e métricas de mercado.",
  cvm_analysis:
    "Análise fundamentalista gerada automaticamente com dados CVM suficientes.",
  cvm_financials:
    "Dados CVM disponíveis, mas ainda sem histórico ou normalização suficiente para análise completa.",
  quote_only:
    "Cotação disponível; dados financeiros ainda pendentes.",
  sector_specific_model_required:
    "Ativo exige metodologia própria, como bancos, seguradoras, FIIs, ETFs ou BDRs.",
  unavailable:
    "Ainda sem cobertura confiável.",
};
