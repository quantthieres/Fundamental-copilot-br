import { describe, it, expect } from "vitest";
import type { BankFinancialRecord } from "./bank-types";
import { computeBankIndicators } from "./bank-indicators";

function rec(overrides: Partial<BankFinancialRecord> & { fiscalYear: number }): BankFinancialRecord {
  return {
    ticker: "TEST4",
    periodEndDate: `${overrides.fiscalYear}-12-31`,
    totalAssets: null,
    equity: null,
    netIncome: null,
    source: "cvm_dfp_bank",
    ...overrides,
  };
}

const R2022 = rec({ fiscalYear: 2022, totalAssets: 1000, equity: 100, netIncome: 20 });
const R2023 = rec({ fiscalYear: 2023, totalAssets: 1200, equity: 120, netIncome: 24, loanPortfolio: 600, deposits: 800 });

describe("computeBankIndicators — single year", () => {
  const ind = computeBankIndicators([R2023])!;

  it("returns non-null", () => expect(ind).not.toBeNull());

  it("roe uses equity directly when no prior year", () => {
    // 24 / 120 = 0.2
    expect(ind.roe).toBeCloseTo(0.2);
  });

  it("roa uses totalAssets directly when no prior year", () => {
    // 24 / 1200 = 0.02
    expect(ind.roa).toBeCloseTo(0.02);
  });

  it("equityToAssets = equity / totalAssets", () => {
    // 120 / 1200 = 0.1
    expect(ind.equityToAssets).toBeCloseTo(0.1);
  });

  it("netIncomeGrowthYoY is null with single year", () => {
    expect(ind.netIncomeGrowthYoY).toBeNull();
  });

  it("assetGrowthYoY is null with single year", () => {
    expect(ind.assetGrowthYoY).toBeNull();
  });

  it("loanToAssets = loanPortfolio / totalAssets", () => {
    // 600 / 1200 = 0.5
    expect(ind.loanToAssets).toBeCloseTo(0.5);
  });

  it("depositsToAssets = deposits / totalAssets", () => {
    // 800 / 1200 ≈ 0.667
    expect(ind.depositsToAssets).toBeCloseTo(0.6667);
  });
});

describe("computeBankIndicators — two years", () => {
  const ind = computeBankIndicators([R2022, R2023])!;

  it("roe uses average equity", () => {
    // avgEquity = (100 + 120) / 2 = 110; roe = 24 / 110 ≈ 0.218
    expect(ind.roe).toBeCloseTo(24 / 110);
  });

  it("roa uses average assets", () => {
    // avgAssets = (1000 + 1200) / 2 = 1100; roa = 24 / 1100 ≈ 0.0218
    expect(ind.roa).toBeCloseTo(24 / 1100);
  });

  it("netIncomeGrowthYoY = (24-20)/20 = 0.2", () => {
    expect(ind.netIncomeGrowthYoY).toBeCloseTo(0.2);
  });

  it("assetGrowthYoY = (1200-1000)/1000 = 0.2", () => {
    expect(ind.assetGrowthYoY).toBeCloseTo(0.2);
  });
});

describe("computeBankIndicators — null safety", () => {
  it("returns null when list is empty", () => {
    expect(computeBankIndicators([])).toBeNull();
  });

  it("roe is null when netIncome is null", () => {
    const ind = computeBankIndicators([rec({ fiscalYear: 2023, equity: 100 })])!;
    expect(ind.roe).toBeNull();
  });

  it("roe is null when equity is null", () => {
    const ind = computeBankIndicators([rec({ fiscalYear: 2023, netIncome: 20 })])!;
    expect(ind.roe).toBeNull();
  });

  it("roe is null when equity is zero", () => {
    const ind = computeBankIndicators([rec({ fiscalYear: 2023, netIncome: 20, equity: 0 })])!;
    expect(ind.roe).toBeNull();
  });

  it("equityToAssets null when totalAssets is null", () => {
    const ind = computeBankIndicators([rec({ fiscalYear: 2023, equity: 100 })])!;
    expect(ind.equityToAssets).toBeNull();
  });

  it("loanToAssets null when loanPortfolio absent", () => {
    const ind = computeBankIndicators([R2022])!;
    expect(ind.loanToAssets).toBeNull();
  });

  it("depositsToAssets null when deposits absent", () => {
    const ind = computeBankIndicators([R2022])!;
    expect(ind.depositsToAssets).toBeNull();
  });

  it("growthRate null when prior netIncome is null", () => {
    const r1 = rec({ fiscalYear: 2022, netIncome: null, totalAssets: 1000, equity: 100 });
    const r2 = rec({ fiscalYear: 2023, netIncome: 20,   totalAssets: 1200, equity: 120 });
    const ind = computeBankIndicators([r1, r2])!;
    expect(ind.netIncomeGrowthYoY).toBeNull();
  });

  it("uses latest year as current regardless of input order", () => {
    const ind = computeBankIndicators([R2023, R2022])!;
    // Should be same as [R2022, R2023]
    expect(ind.netIncomeGrowthYoY).toBeCloseTo(0.2);
  });
});
