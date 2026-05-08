import { describe, it, expect } from "vitest";
import { cvmFinancialsToDashboardFinancials, buildCvmFundamentalsFromFinancials } from "./transformers";
import type { NormalizedFinancials } from "./types";
import type { CompanyFundamentals } from "@/data/companies/types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

// Deliberately unsorted to verify sort behavior.
const THREE_YEARS: NormalizedFinancials[] = [
  { ticker: "TEST3", fiscalYear: 2022, revenue: 20,   ebit: 4,   freeCashFlow: 3,   netDebt: 2   },
  { ticker: "TEST3", fiscalYear: 2021, revenue: 18,   ebit: 3.5, freeCashFlow: 2.5, netDebt: 2.5 },
  { ticker: "TEST3", fiscalYear: 2023, revenue: 22,   ebit: 4.5, freeCashFlow: 3.5, netDebt: 1.5 },
];

const FALLBACK: CompanyFundamentals = {
  currentRevenue:    15,
  sharesOutstanding:  5,
  netDebt:            3,
};

// ─── cvmFinancialsToDashboardFinancials ───────────────────────────────────────

describe("cvmFinancialsToDashboardFinancials", () => {
  it("returns the same number of entries as input", () => {
    const result = cvmFinancialsToDashboardFinancials(THREE_YEARS);
    expect(result).toHaveLength(3);
  });

  it("sorts output oldest to newest", () => {
    const result = cvmFinancialsToDashboardFinancials(THREE_YEARS);
    const years = result.map(r => Number(r.year));
    expect(years).toEqual([2021, 2022, 2023]);
  });

  it("maps fiscalYear to year as a string", () => {
    const result = cvmFinancialsToDashboardFinancials(THREE_YEARS);
    expect(result[0].year).toBe("2021");
    expect(result[1].year).toBe("2022");
    expect(result[2].year).toBe("2023");
  });

  it("maps revenue to receita", () => {
    const result = cvmFinancialsToDashboardFinancials(THREE_YEARS);
    expect(result[0].receita).toBe(18);  // 2021
    expect(result[1].receita).toBe(20);  // 2022
    expect(result[2].receita).toBe(22);  // 2023
  });

  it("maps ebit to ebitda as proxy", () => {
    const result = cvmFinancialsToDashboardFinancials(THREE_YEARS);
    expect(result[0].ebitda).toBe(3.5);  // 2021 ebit
    expect(result[1].ebitda).toBe(4);    // 2022 ebit
    expect(result[2].ebitda).toBe(4.5);  // 2023 ebit
  });

  it("maps freeCashFlow to fcl", () => {
    const result = cvmFinancialsToDashboardFinancials(THREE_YEARS);
    expect(result[0].fcl).toBe(2.5);  // 2021 FCF
    expect(result[1].fcl).toBe(3);    // 2022 FCF
    expect(result[2].fcl).toBe(3.5);  // 2023 FCF
  });

  it("uses 0 as fallback for undefined revenue", () => {
    const input: NormalizedFinancials[] = [{ ticker: "X3", fiscalYear: 2023 }];
    const result = cvmFinancialsToDashboardFinancials(input);
    expect(result[0].receita).toBe(0);
  });

  it("uses 0 as fallback for undefined ebit", () => {
    const input: NormalizedFinancials[] = [{ ticker: "X3", fiscalYear: 2023 }];
    const result = cvmFinancialsToDashboardFinancials(input);
    expect(result[0].ebitda).toBe(0);
  });

  it("uses 0 as fallback for undefined freeCashFlow", () => {
    const input: NormalizedFinancials[] = [{ ticker: "X3", fiscalYear: 2023 }];
    const result = cvmFinancialsToDashboardFinancials(input);
    expect(result[0].fcl).toBe(0);
  });

  it("does not mutate the input array order", () => {
    const input = [...THREE_YEARS];
    cvmFinancialsToDashboardFinancials(input);
    // Original first element should still be 2022 (as passed in)
    expect(input[0].fiscalYear).toBe(2022);
  });

  it("handles a single-entry array", () => {
    const input: NormalizedFinancials[] = [
      { ticker: "X3", fiscalYear: 2023, revenue: 10, ebit: 2, freeCashFlow: 1.5, netDebt: 0 },
    ];
    const result = cvmFinancialsToDashboardFinancials(input);
    expect(result).toHaveLength(1);
    expect(result[0].year).toBe("2023");
    expect(result[0].receita).toBe(10);
  });
});

// ─── buildCvmFundamentalsFromFinancials ───────────────────────────────────────

describe("buildCvmFundamentalsFromFinancials", () => {
  it("uses the latest year's revenue as currentRevenue", () => {
    const result = buildCvmFundamentalsFromFinancials(THREE_YEARS, FALLBACK);
    expect(result.currentRevenue).toBe(22);  // 2023
  });

  it("uses the latest year's netDebt", () => {
    const result = buildCvmFundamentalsFromFinancials(THREE_YEARS, FALLBACK);
    expect(result.netDebt).toBe(1.5);  // 2023
  });

  it("preserves sharesOutstanding from fallback", () => {
    const result = buildCvmFundamentalsFromFinancials(THREE_YEARS, FALLBACK);
    expect(result.sharesOutstanding).toBe(FALLBACK.sharesOutstanding);
  });

  it("returns fallback unchanged when financials array is empty", () => {
    const result = buildCvmFundamentalsFromFinancials([], FALLBACK);
    expect(result).toEqual(FALLBACK);
  });

  it("uses fallback currentRevenue when latest.revenue is undefined", () => {
    const input: NormalizedFinancials[] = [{ ticker: "X3", fiscalYear: 2023, netDebt: 1 }];
    const result = buildCvmFundamentalsFromFinancials(input, FALLBACK);
    expect(result.currentRevenue).toBe(FALLBACK.currentRevenue);
  });

  it("uses fallback netDebt when latest.netDebt is undefined", () => {
    const input: NormalizedFinancials[] = [{ ticker: "X3", fiscalYear: 2023, revenue: 25 }];
    const result = buildCvmFundamentalsFromFinancials(input, FALLBACK);
    expect(result.netDebt).toBe(FALLBACK.netDebt);
  });

  it("picks the most recent year even when input is unordered", () => {
    const unordered: NormalizedFinancials[] = [
      { ticker: "X3", fiscalYear: 2020, revenue: 10, netDebt: 5 },
      { ticker: "X3", fiscalYear: 2023, revenue: 25, netDebt: 1 },
      { ticker: "X3", fiscalYear: 2021, revenue: 15, netDebt: 4 },
    ];
    const result = buildCvmFundamentalsFromFinancials(unordered, FALLBACK);
    expect(result.currentRevenue).toBe(25);  // 2023
    expect(result.netDebt).toBe(1);
  });
});
