import { describe, it, expect } from "vitest";
import {
  safeDivide,
  calculateGrowth,
  calculateCagr,
  buildFundamentalIndicators,
} from "./indicators";
import type { NormalizedFinancials } from "@/lib/cvm/types";
import type { MarketDataQuote } from "@/lib/market-data/types";

// ─── safeDivide ───────────────────────────────────────────────────────────────

describe("safeDivide", () => {
  it("returns numerator/denominator for valid inputs", () => {
    expect(safeDivide(10, 2)).toBeCloseTo(5);
    expect(safeDivide(1, 4)).toBeCloseTo(0.25);
  });

  it("returns null when denominator is zero", () => {
    expect(safeDivide(10, 0)).toBeNull();
  });

  it("returns null when numerator is undefined", () => {
    expect(safeDivide(undefined, 5)).toBeNull();
  });

  it("returns null when denominator is undefined", () => {
    expect(safeDivide(5, undefined)).toBeNull();
  });

  it("handles negative numerators", () => {
    expect(safeDivide(-10, 2)).toBeCloseTo(-5);
  });
});

// ─── calculateGrowth ─────────────────────────────────────────────────────────

describe("calculateGrowth", () => {
  it("returns correct growth rate", () => {
    expect(calculateGrowth(110, 100)).toBeCloseTo(0.1);
  });

  it("returns negative growth for decline", () => {
    expect(calculateGrowth(90, 100)).toBeCloseTo(-0.1);
  });

  it("returns null when previous is zero", () => {
    expect(calculateGrowth(100, 0)).toBeNull();
  });

  it("returns null when current is undefined", () => {
    expect(calculateGrowth(undefined, 100)).toBeNull();
  });

  it("returns null when previous is undefined", () => {
    expect(calculateGrowth(100, undefined)).toBeNull();
  });

  it("handles negative previous value correctly (uses abs)", () => {
    const result = calculateGrowth(-80, -100);
    expect(result).toBeCloseTo(0.2);
  });
});

// ─── calculateCagr ───────────────────────────────────────────────────────────

describe("calculateCagr", () => {
  it("returns correct CAGR for 2 years of growth", () => {
    // 100 → 121 over 2 years: CAGR = 10%
    expect(calculateCagr(100, 121, 2)).toBeCloseTo(0.1);
  });

  it("returns 0 when start equals end", () => {
    expect(calculateCagr(100, 100, 3)).toBeCloseTo(0);
  });

  it("returns null when start is zero", () => {
    expect(calculateCagr(0, 100, 3)).toBeNull();
  });

  it("returns null when start is negative", () => {
    expect(calculateCagr(-50, 100, 3)).toBeNull();
  });

  it("returns null when years is zero", () => {
    expect(calculateCagr(100, 200, 0)).toBeNull();
  });

  it("returns null when start is undefined", () => {
    expect(calculateCagr(undefined, 100, 3)).toBeNull();
  });
});

// ─── buildFundamentalIndicators ───────────────────────────────────────────────

const FINANCIALS: NormalizedFinancials[] = [
  {
    ticker: "TEST",
    fiscalYear: 2021,
    revenue: 100,
    ebit: 20,
    netIncome: 15,
    operatingCashFlow: 22,
    capex: 8,
    freeCashFlow: 14,
    cash: 30,
    totalDebt: 50,
    netDebt: 20,
  },
  {
    ticker: "TEST",
    fiscalYear: 2022,
    revenue: 120,
    ebit: 26,
    netIncome: 18,
    operatingCashFlow: 27,
    capex: 9,
    freeCashFlow: 18,
    cash: 35,
    totalDebt: 55,
    netDebt: 20,
  },
  {
    ticker: "TEST",
    fiscalYear: 2023,
    revenue: 132,
    ebit: 29,
    netIncome: 20,
    operatingCashFlow: 31,
    capex: 10,
    freeCashFlow: 21,
    cash: 40,
    totalDebt: 60,
    netDebt: 20,
  },
];

const QUOTE: MarketDataQuote = {
  ticker: "TEST",
  price: 25,
  marketCap: 50_000_000_000,
  change: 0.5,
  changePercent: 2.0,
  source: "brapi",
};

function build(financials = FINANCIALS, quote: MarketDataQuote | null = QUOTE) {
  return buildFundamentalIndicators(financials, quote);
}

describe("buildFundamentalIndicators — growth indicators", () => {
  it("calculates revenueGrowthYoY correctly", () => {
    const ind = build();
    // 2023 vs 2022: (132 - 120) / 120 = 0.1
    expect(ind.growth.revenueGrowthYoY).toBeCloseTo(0.1);
  });

  it("calculates revenueCAGR correctly", () => {
    const ind = build();
    // 100 → 132 over 2 years: CAGR = (132/100)^0.5 - 1 ≈ 0.1489
    const expected = Math.pow(132 / 100, 1 / 2) - 1;
    expect(ind.growth.revenueCAGR).toBeCloseTo(expected, 3);
  });

  it("calculates ebitGrowthYoY correctly", () => {
    const ind = build();
    // 2023 vs 2022: (29 - 26) / 26 ≈ 0.1154
    expect(ind.growth.ebitGrowthYoY).toBeCloseTo(3 / 26, 3);
  });

  it("returns null revenueCAGR with only 2 years of data", () => {
    const ind = buildFundamentalIndicators([FINANCIALS[1], FINANCIALS[2]], QUOTE);
    expect(ind.growth.revenueCAGR).toBeNull();
  });
});

describe("buildFundamentalIndicators — margin indicators", () => {
  it("calculates ebitMargin correctly", () => {
    const ind = build();
    // 29 / 132 ≈ 0.2197
    expect(ind.margins.ebitMargin).toBeCloseTo(29 / 132, 3);
  });

  it("calculates netMargin correctly", () => {
    const ind = build();
    // 20 / 132 ≈ 0.1515
    expect(ind.margins.netMargin).toBeCloseTo(20 / 132, 3);
  });

  it("calculates fcfMargin correctly", () => {
    const ind = build();
    // 21 / 132 ≈ 0.1591
    expect(ind.margins.fcfMargin).toBeCloseTo(21 / 132, 3);
  });

  it("returns null margins for empty financials", () => {
    const ind = buildFundamentalIndicators([], null);
    expect(ind.margins.ebitMargin).toBeNull();
    expect(ind.margins.netMargin).toBeNull();
  });
});

describe("buildFundamentalIndicators — cash conversion", () => {
  it("calculates cfoOverNetIncome correctly", () => {
    const ind = build();
    // 31 / 20 = 1.55
    expect(ind.cashConversion.cfoOverNetIncome).toBeCloseTo(1.55);
  });

  it("calculates fcfOverNetIncome correctly", () => {
    const ind = build();
    // 21 / 20 = 1.05
    expect(ind.cashConversion.fcfOverNetIncome).toBeCloseTo(1.05);
  });

  it("calculates capexOverRevenue correctly", () => {
    const ind = build();
    // 10 / 132 ≈ 0.0758
    expect(ind.cashConversion.capexOverRevenue).toBeCloseTo(10 / 132, 3);
  });
});

describe("buildFundamentalIndicators — debt indicators", () => {
  it("returns netDebt from latest year", () => {
    const ind = build();
    expect(ind.debt.netDebt).toBe(20);
  });

  it("calculates netDebtOverEbit correctly", () => {
    const ind = build();
    // 20 / 29 ≈ 0.6897
    expect(ind.debt.netDebtOverEbit).toBeCloseTo(20 / 29, 3);
  });
});

describe("buildFundamentalIndicators — market indicators", () => {
  it("returns marketCapB in billions", () => {
    const ind = build();
    // 50_000_000_000 / 1e9 = 50
    expect(ind.market.marketCapB).toBeCloseTo(50);
  });

  it("calculates pe correctly", () => {
    const ind = build();
    // 50 / 20 = 2.5
    expect(ind.market.pe).toBeCloseTo(2.5);
  });

  it("calculates evOverEbit correctly", () => {
    const ind = build();
    // EV = 50 + 20 = 70; 70 / 29 ≈ 2.414
    expect(ind.market.evOverEbit).toBeCloseTo(70 / 29, 3);
  });

  it("returns null market indicators when quote is null", () => {
    const ind = buildFundamentalIndicators(FINANCIALS, null);
    expect(ind.market.marketCapB).toBeNull();
    expect(ind.market.pe).toBeNull();
    expect(ind.market.evOverEbit).toBeNull();
  });
});

describe("buildFundamentalIndicators — empty/missing data", () => {
  it("returns all nulls for empty financials with no quote", () => {
    const ind = buildFundamentalIndicators([], null);
    expect(ind.growth.revenueGrowthYoY).toBeNull();
    expect(ind.growth.revenueCAGR).toBeNull();
    expect(ind.margins.ebitMargin).toBeNull();
    expect(ind.debt.netDebt).toBeNull();
    expect(ind.market.marketCapB).toBeNull();
  });

  it("returns growth indicators as null when only 1 year provided", () => {
    const ind = buildFundamentalIndicators([FINANCIALS[2]], QUOTE);
    expect(ind.growth.revenueGrowthYoY).toBeNull();
    expect(ind.growth.ebitGrowthYoY).toBeNull();
  });
});
