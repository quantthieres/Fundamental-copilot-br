export type BankFinancialRecord = {
  ticker: string;
  fiscalYear: number;
  periodEndDate: string;

  totalAssets: number | null;
  equity: number | null;
  netIncome: number | null;

  loanPortfolio?: number | null;
  deposits?: number | null;
  financialIntermediationIncome?: number | null;
  provisionExpense?: number | null;

  source: "cvm_dfp_bank";
};

export type BankIndicators = {
  roe: number | null;
  roa: number | null;
  equityToAssets: number | null;
  netIncomeGrowthYoY: number | null;
  assetGrowthYoY: number | null;
  loanToAssets?: number | null;
  depositsToAssets?: number | null;
};

export type BankAnalysisResponse = {
  ticker: string;
  source: "bank_analysis";
  sourceDetail: "bank_cvm_cache" | "bank_unavailable";
  available: boolean;
  company?: {
    ticker: string;
    companyName: string;
    cvmCode?: string;
    cnpj?: string;
  };
  annual: BankFinancialRecord[];
  indicators: BankIndicators | null;
  updatedAt: string;
  warnings: string[];
};
