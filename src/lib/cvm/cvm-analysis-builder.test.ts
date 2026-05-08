import { describe, it, expect } from "vitest";
import {
  isCvmAnalysisEligible,
  cvmAnalysisEligibilityReason,
  buildCompanyAnalysisDataFromCvm,
} from "./cvm-analysis-builder";
import type { B3Asset } from "@/data/b3-universe";
import type { NormalizedFinancials } from "./types";
import type { MarketDataQuote } from "@/lib/market-data/types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ENTRY: B3Asset = {
  ticker: "PETR4",
  companyName: "Petróleo Brasileiro S.A.",
  tradingName: "Petrobras PN",
  sector: "Petróleo e Gás",
  subsector: "Exploração e Refino",
  assetType: "stock",
  hasMockData: false,
  hasCvmMapping: true,
  coverageStatus: "cvm_financials",
};

const THREE_YEARS: NormalizedFinancials[] = [
  {
    ticker: "PETR4",
    fiscalYear: 2021,
    revenue: 400,
    ebit: 80,
    netIncome: 50,
    operatingCashFlow: 120,
    capex: 60,
    freeCashFlow: 60,
    cash: 50,
    totalDebt: 200,
    netDebt: 150,
  },
  {
    ticker: "PETR4",
    fiscalYear: 2022,
    revenue: 520,
    ebit: 110,
    netIncome: 70,
    operatingCashFlow: 160,
    capex: 80,
    freeCashFlow: 80,
    cash: 60,
    totalDebt: 210,
    netDebt: 150,
  },
  {
    ticker: "PETR4",
    fiscalYear: 2023,
    revenue: 480,
    ebit: 100,
    netIncome: 65,
    operatingCashFlow: 140,
    capex: 70,
    freeCashFlow: 70,
    cash: 55,
    totalDebt: 205,
    netDebt: 150,
  },
];

const QUOTE: MarketDataQuote = {
  ticker: "PETR4",
  price: 38,
  marketCap: 494_000_000_000,
  change: 0.5,
  changePercent: 1.3,
  source: "brapi",
};

function build(
  financials = THREE_YEARS,
  quote: MarketDataQuote | null = QUOTE,
  entry: B3Asset = ENTRY,
) {
  return buildCompanyAnalysisDataFromCvm({
    b3Entry: entry,
    cvmFinancials: financials,
    marketQuote: quote,
  });
}

// ─── isCvmAnalysisEligible ────────────────────────────────────────────────────

describe("isCvmAnalysisEligible", () => {
  it("returns true for a valid CVM stock entry with cvm_financials status", () => {
    expect(isCvmAnalysisEligible(ENTRY)).toBe(true);
  });

  it("returns true when coverageStatus is cvm_analysis", () => {
    expect(isCvmAnalysisEligible({ ...ENTRY, coverageStatus: "cvm_analysis" })).toBe(true);
  });

  it("returns false when hasMockData is true", () => {
    expect(isCvmAnalysisEligible({ ...ENTRY, hasMockData: true })).toBe(false);
  });

  it("returns false when coverageStatus is quote_only", () => {
    expect(isCvmAnalysisEligible({ ...ENTRY, coverageStatus: "quote_only" })).toBe(false);
  });

  it("returns false when coverageStatus is full_analysis", () => {
    expect(isCvmAnalysisEligible({ ...ENTRY, coverageStatus: "full_analysis" })).toBe(false);
  });

  it("returns false when hasCvmMapping is false", () => {
    expect(isCvmAnalysisEligible({ ...ENTRY, hasCvmMapping: false })).toBe(false);
  });

  it("returns false for fii, bdr and etf assetTypes", () => {
    expect(isCvmAnalysisEligible({ ...ENTRY, assetType: "fii" })).toBe(false);
    expect(isCvmAnalysisEligible({ ...ENTRY, assetType: "bdr" })).toBe(false);
    expect(isCvmAnalysisEligible({ ...ENTRY, assetType: "etf" })).toBe(false);
  });

  it("returns true for unit assetType", () => {
    expect(isCvmAnalysisEligible({ ...ENTRY, assetType: "unit" })).toBe(true);
  });
});

// ─── cvmAnalysisEligibilityReason ─────────────────────────────────────────────

const ALL_ZERO_LATEST = THREE_YEARS.map(f =>
  f.fiscalYear === 2023
    ? { ...f, revenue: 0, ebit: 0, netIncome: 0, operatingCashFlow: 0,
        capex: 0, freeCashFlow: 0, netDebt: 0 }
    : f,
);

const ALL_OTHER_FIELDS_ZERO = THREE_YEARS.map(f =>
  f.fiscalYear === 2023
    ? { ...f, ebit: 0, netIncome: 0, operatingCashFlow: 0,
        capex: 0, freeCashFlow: 0, netDebt: 0 }
    : f,
);

const NO_INCOME_METRICS: NormalizedFinancials[] = [
  { ...THREE_YEARS[0] },
  { ...THREE_YEARS[1] },
  {
    ticker: "PETR4",
    fiscalYear: 2023,
    revenue: 200,
    capex: 15,
    netDebt: 80,
  },
];

describe("cvmAnalysisEligibilityReason", () => {
  it("returns null for valid financials", () => {
    expect(cvmAnalysisEligibilityReason(THREE_YEARS)).toBeNull();
  });

  it("returns a reason string containing 'year' for fewer than 3 years", () => {
    expect(cvmAnalysisEligibilityReason([THREE_YEARS[0]])).toContain("year");
    expect(cvmAnalysisEligibilityReason([THREE_YEARS[0], THREE_YEARS[1]])).toContain("year");
  });

  it("returns 'only 0 year(s) of data' for empty array", () => {
    expect(cvmAnalysisEligibilityReason([])).toBe("only 0 year(s) of data");
  });

  it("returns 'latest revenue missing' when revenue is undefined in latest year", () => {
    const noRevenue = THREE_YEARS.map(f =>
      f.fiscalYear === 2023 ? { ...f, revenue: undefined } : f,
    );
    expect(cvmAnalysisEligibilityReason(noRevenue)).toBe("latest revenue missing");
  });

  it("returns 'latest revenue <= 0' when revenue is 0 in latest year", () => {
    expect(cvmAnalysisEligibilityReason(ALL_ZERO_LATEST)).toBe("latest revenue <= 0");
  });

  it("returns 'latest revenue <= 0' when revenue is explicitly negative", () => {
    const negRevenue = THREE_YEARS.map(f =>
      f.fiscalYear === 2023 ? { ...f, revenue: -1 } : f,
    );
    expect(cvmAnalysisEligibilityReason(negRevenue)).toBe("latest revenue <= 0");
  });

  it("returns 'all latest metrics are zero' when revenue > 0 but all other fields are zero", () => {
    expect(cvmAnalysisEligibilityReason(ALL_OTHER_FIELDS_ZERO)).toBe("all latest metrics are zero");
  });

  it("returns 'no usable income/cash-flow metric' when income metrics are absent", () => {
    expect(cvmAnalysisEligibilityReason(NO_INCOME_METRICS)).toBe("no usable income/cash-flow metric");
  });

  it("passes when ebit is undefined but netIncome is non-zero", () => {
    const noEbit = THREE_YEARS.map(f =>
      f.fiscalYear === 2023 ? { ...f, ebit: undefined } : f,
    );
    expect(cvmAnalysisEligibilityReason(noEbit)).toBeNull();
  });

  it("passes when operatingCashFlow is undefined but ebit is non-zero", () => {
    const noOcf = THREE_YEARS.map(f =>
      f.fiscalYear === 2023 ? { ...f, operatingCashFlow: undefined } : f,
    );
    expect(cvmAnalysisEligibilityReason(noOcf)).toBeNull();
  });
});

// ─── buildCompanyAnalysisDataFromCvm — null cases ─────────────────────────────

describe("buildCompanyAnalysisDataFromCvm — null cases", () => {
  it("returns null when fewer than 3 years of data", () => {
    expect(build([THREE_YEARS[0]])).toBeNull();
    expect(build([THREE_YEARS[0], THREE_YEARS[1]])).toBeNull();
  });

  it("returns null when latest year has no revenue", () => {
    const noRevenue = THREE_YEARS.map(f =>
      f.fiscalYear === 2023 ? { ...f, revenue: undefined } : f,
    );
    expect(build(noRevenue)).toBeNull();
  });

  it("returns null when marketQuote is null", () => {
    expect(build(THREE_YEARS, null)).toBeNull();
  });

  it("returns null when price is 0", () => {
    expect(build(THREE_YEARS, { ...QUOTE, price: 0 })).toBeNull();
  });

  it("returns null when marketCap is absent", () => {
    const { marketCap: _, ...noMktCap } = QUOTE;
    expect(build(THREE_YEARS, noMktCap as MarketDataQuote)).toBeNull();
  });

  it("returns null when latest revenue is 0", () => {
    expect(build(ALL_ZERO_LATEST)).toBeNull();
  });

  it("returns null when all latest metrics are zero despite valid revenue", () => {
    expect(build(ALL_OTHER_FIELDS_ZERO)).toBeNull();
  });
});

// ─── buildCompanyAnalysisDataFromCvm — successful build ──────────────────────

describe("buildCompanyAnalysisDataFromCvm — successful build", () => {
  it("returns a non-null CompanyData object", () => {
    expect(build()).not.toBeNull();
  });

  it("sets company.ticker and company.name from B3 entry", () => {
    const result = build()!;
    expect(result.company.ticker).toBe("PETR4");
    expect(result.company.name).toBe("Petróleo Brasileiro S.A.");
  });

  it("does not include valuationStatus on company profile", () => {
    const result = build()!;
    expect((result.company as unknown as Record<string, unknown>)["valuationStatus"]).toBeUndefined();
  });

  it("does not include upside on company profile", () => {
    const result = build()!;
    expect((result.company as unknown as Record<string, unknown>)["upside"]).toBeUndefined();
  });

  it("does not include defaultAssumptions on CompanyData", () => {
    const result = build()!;
    expect((result as unknown as Record<string, unknown>)["defaultAssumptions"]).toBeUndefined();
  });

  it("does not include waccVals on CompanyData", () => {
    const result = build()!;
    expect((result as unknown as Record<string, unknown>)["waccVals"]).toBeUndefined();
  });

  it("sets fundamentals.currentRevenue to latest year revenue", () => {
    expect(build()!.fundamentals.currentRevenue).toBe(480);
  });

  it("sets fundamentals.netDebt from latest year netDebt", () => {
    expect(build()!.fundamentals.netDebt).toBe(150);
  });

  it("estimates fundamentals.sharesOutstanding from marketCap / price (in billions)", () => {
    const result = build()!;
    const expected = 494 / 38;
    expect(result.fundamentals.sharesOutstanding).toBeCloseTo(expected, 2);
  });

  it("multiples array is empty (no fabricated peers)", () => {
    expect(build()!.multiples).toHaveLength(0);
  });

  it("news array is empty", () => {
    expect(build()!.news).toHaveLength(0);
  });
});

// ─── buildCompanyAnalysisDataFromCvm — financials order ──────────────────────

describe("buildCompanyAnalysisDataFromCvm — financials order", () => {
  it("returns financials sorted oldest-to-newest (year ascending)", () => {
    const reversed = [...THREE_YEARS].reverse();
    const result = buildCompanyAnalysisDataFromCvm({
      b3Entry: ENTRY,
      cvmFinancials: reversed,
      marketQuote: QUOTE,
    })!;
    const years = result.financials.map(f => Number(f.year));
    expect(years).toEqual([...years].sort((a, b) => a - b));
  });

  it("financials length equals input length", () => {
    expect(build()!.financials).toHaveLength(THREE_YEARS.length);
  });

  it("does not mutate the input financials array", () => {
    const input = THREE_YEARS.map(f => ({ ...f }));
    const inputCopy = input.map(f => ({ ...f }));
    buildCompanyAnalysisDataFromCvm({ b3Entry: ENTRY, cvmFinancials: input, marketQuote: QUOTE });
    expect(input).toEqual(inputCopy);
  });
});
