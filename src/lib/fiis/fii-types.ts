export type FiiFinancialRecord = {
  ticker: string;
  referenceDate: string;

  netAssetValue: number | null;
  quotaCount: number | null;
  netAssetValuePerShare: number | null;

  monthlyDistributionPerShare?: number | null;

  source: "fii_cvm_cache" | "fii_unavailable";
};

export type FiiIndicators = {
  netAssetValuePerShare: number | null;
  lastDistributionPerShare: number | null;
  twelveMonthDistributionPerShare: number | null;
  dividendYield12m: number | null;
  priceToBookValuePerShare: number | null;
};

export type FiiAnalysisResponse = {
  ticker: string;
  source: "fii_analysis";
  sourceDetail: "fii_cvm_cache" | "fii_unavailable";
  available: boolean;
  fund?: {
    ticker: string;
    name: string;
    cnpj?: string;
  };
  records: FiiFinancialRecord[];
  indicators: FiiIndicators | null;
  updatedAt: string;
  warnings: string[];
};
