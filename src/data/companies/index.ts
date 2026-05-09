import type { CompanyData } from "./types";
import wege3 from "./wege3";
import egie3 from "./egie3";
import cpfe3 from "./cpfe3";
import abev3 from "./abev3";
import vivt3 from "./vivt3";

export type { CompanyData } from "./types";

const COMPANY_REGISTRY: Record<string, CompanyData> = {
  WEGE3: wege3,
  EGIE3: egie3,
  CPFE3: cpfe3,
  ABEV3: abev3,
  VIVT3: vivt3,
};

export function getCompanyData(ticker: string): CompanyData | null {
  return COMPANY_REGISTRY[ticker] ?? null;
}
