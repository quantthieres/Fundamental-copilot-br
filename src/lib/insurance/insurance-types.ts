export type InsuranceFinancialRecord = {
  ticker: string;
  fiscalYear: number;
  periodEndDate: string;

  totalAssets: number | null;          // BRL billions
  equity: number | null;
  netIncome: number | null;

  insurancePremiums?: number | null;   // Prêmios ganhos / receita de prêmios
  claimsExpense?: number | null;       // Sinistros ocorridos / retidos
  technicalProvisions?: number | null; // Provisões técnicas (BPP)
  financialResult?: number | null;     // Resultado financeiro

  source: "cvm_dfp_insurance";
};

export type InsuranceIndicators = {
  roe: number | null;
  roa: number | null;
  equityToAssets: number | null;
  netIncomeGrowthYoY: number | null;
  assetGrowthYoY: number | null;
  claimsRatio?: number | null;         // claimsExpense / insurancePremiums
};

export type InsuranceAnalysisResponse = {
  ticker: string;
  source: "insurance_analysis";
  sourceDetail: "insurance_cvm_cache" | "insurance_unavailable";
  available: boolean;
  company?: {
    ticker: string;
    companyName: string;
    cvmCode?: string;
    cnpj?: string;
  };
  annual: InsuranceFinancialRecord[];
  indicators: InsuranceIndicators | null;
  updatedAt: string;
  warnings: string[];
};
