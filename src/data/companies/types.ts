export interface CompanyProfile {
  name: string;
  ticker: string;
  exchange: string;
  sector: string;
  price: number;
  priceChange: number;
  priceChangePct: number;
  marketCap: string;
  enterpriseValue: string;
  currency: string;
}

export interface MetricItem {
  label: string;
  value: string;
  trend: number;
  suffix: string;
}

export interface FinancialYear {
  year: string;
  receita: number;
  ebitda: number;
  fcl: number;
}

export interface CompanyFundamentals {
  currentRevenue: number;
  sharesOutstanding: number;
  netDebt: number;
}

export interface MultipleItem {
  company: string;
  ticker: string;
  pe: string;
  evEbitda: string;
  evSales: string;
  highlight: boolean;
}

export interface NewsItem {
  source: string;
  date: string;
  title: string;
  category: string;
}

export interface CompanyData {
  company: CompanyProfile;
  metrics: MetricItem[];
  financials: FinancialYear[];
  fundamentals: CompanyFundamentals;
  multiples: MultipleItem[];
  news: NewsItem[];
}
