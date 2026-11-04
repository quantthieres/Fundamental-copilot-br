import { describe, expect, it } from "vitest";
import { computeHoldingIndicators, holdingNetDebt, largestInvesteeConcentration } from "./holding-indicators";
import { readHoldingCache } from "./holding-cache";
import type { HoldingIndicators } from "./holding-types";

// Indicators recomputed from the committed caches (official sources).
const M = 1_000_000;
const indicators = (t: string): HoldingIndicators => {
  const c = readHoldingCache(t)!;
  return computeHoldingIndicators(c.statements, c.portfolio);
};

describe("holding indicators — Itaúsa (statements 2026-06-30, portfolio 2026-09-30)", () => {
  const i = indicators("ITSA4");

  it("core portfolio indicators come from the official snapshot", () => {
    expect(i.core.officialPortfolioValue).toMatchObject({ value: 199_950 * M, asOf: ["2026-09-30"] });
    expect(i.core.listedInvestmentValue.value).toBe((183_118 + 1_991 + 2_949 + 3_495) * M);
    expect(i.core.unlistedInvestmentValue.value).toBe((6_108 + 2_025 + 1_505) * M);
    expect(i.core.largestInvesteeConcentration.investee).toBe("Itaú Unibanco");
    expect(i.core.largestInvesteeConcentration.value).toBeCloseTo(183_118 / 201_191, 6);
    expect(i.core.officialMarketValue.value).toBe(163_627 * M);
    expect(i.core.officialDiscount.value).toBe(-0.182);
  });

  it("largest investee concentration = largest positive investee / Σ positive investees (not the net SOTP)", () => {
    const p = readHoldingCache("ITSA4")!.portfolio!;
    const investees = p.components.filter(c => c.kind === "investment");
    const positiveTotal = investees.filter(c => c.value > 0).reduce((s, c) => s + c.value, 0);
    expect(positiveTotal).toBe((191_553 + 9_638) * M);            // 201,191
    expect(p.components.find(c => c.name === "Demais Ativos e Passivos")!.kind).toBe("other_assets_liabilities");
    expect(p.officialPortfolioValue).toBe(199_950 * M);
    expect(i.core.largestInvesteeConcentration.value).toBe(0.91017);  // 183,118 / 201,191, rounded to 1e-6
    expect(i.core.largestInvesteeConcentration.value).not.toBeCloseTo(183_118 / 199_950, 3);
    expect(i.core.largestInvesteeConcentration.note).toMatch(/not a share of the net sum of the parts/);
  });

  it("concentration ignores non-investee and non-positive lines", () => {
    const p = readHoldingCache("ITSA4")!.portfolio!;
    const withNegative = { ...p, components: [...p.components, { ...p.components[1], name: "Negativa", value: -5_000 * M }] };
    expect(largestInvesteeConcentration(withNegative)).toEqual(largestInvesteeConcentration(p));
    expect(largestInvesteeConcentration(null)).toEqual({ value: null, investee: null });
  });

  it("net debt is gross debt minus 1.01.01 cash — NTS and stakes are not subtracted", () => {
    expect(i.core.holdingCash.value).toBe(2_191 * M);
    expect(i.core.grossDebt.value).toBe(3_375 * M);
    expect(i.core.netDebt.value).toBe(1_184 * M);
    expect(i.core.netDebtToOfficialPortfolioValue.asOf).toEqual(["2026-06-30", "2026-09-30"]);
  });

  it("TTM flows: 1S26 + FY25 − 1S25", () => {
    expect(i.core.dividendsReceivedTtm).toMatchObject({ value: 12_498 * M, asOf: ["2026-06-30", "2025-12-31", "2025-06-30"] });
    expect(i.core.generalAdministrativeExpensesTtm.value).toBe((-89 - 185 + 88) * M);
    expect(i.core.equityMethodIncomeTtm.value).toBe((10_129 + 17_291 - 8_412) * M);
    expect(i.secondary.netIncomeTtm.value).toBe((9_654 + 16_487 - 7_980) * M);
    expect(i.secondary.financialExpensesTtm.value).toBe((-680 - 1_405 + 775) * M);
    expect(i.secondary.dividendsReceivedToFinancialExpenses.value).toBeCloseTo(12_498 / 1_310, 5);
    expect(i.secondary.grossDebtToDividendsReceived.value).toBeCloseTo(3_375 / 12_498, 5);
  });

  it("standardized class-weighted market cap is null without a same-date ITSA3 price", () => {
    expect(i.secondary.standardizedClassWeightedMarketCap.value).toBeNull();
  });
});

describe("holding indicators — Bradespar (statements 2026-06-30, bulletin 2026-10-30)", () => {
  const i = indicators("BRAP4");

  it("single listed investee, no borrowings", () => {
    expect(i.core.largestInvesteeConcentration).toMatchObject({ value: 1, investee: "Vale" });
    expect(i.core.listedInvestmentValue.value).toBe(10_131_252_000);
    expect(i.core.grossDebt.value).toBe(0);
    expect(i.core.netDebt.value).toBe(-254_451_000);
    expect(i.secondary.dividendsReceivedToFinancialExpenses).toMatchObject({ value: null, note: expect.stringMatching(/no borrowings/) });
  });

  it("official vs standardized market value stay distinct", () => {
    expect(i.core.officialMarketValue.value).toBe(7_014_908_000);
    expect(i.secondary.standardizedClassWeightedMarketCap.value).toBeCloseTo(7_014_907_288.12, 2);
  });

  it("TTM dividends received", () => {
    expect(i.core.dividendsReceivedTtm.value).toBe(809_817_000);
  });

  it("statement net debt (CVM 30/06) and bulletin net cash (30/10) coexist and never overwrite each other", () => {
    const c = readHoldingCache("BRAP4")!;
    const st = c.statements[c.statements.length - 1];
    const pf = c.portfolio!;
    expect(st).toMatchObject({ periodEnd: "2026-06-30", cash: 254_451_000, grossDebt: 0, netDebt: -254_451_000 });
    expect(pf.publishedNetCash).toMatchObject({ value: 511_033_000, referenceDate: "2026-10-30", usage: "input_to_official_portfolio_value" });
    expect(st.periodEnd).not.toBe(pf.publishedNetCash!.referenceDate);
    expect(i.core.holdingCash).toMatchObject({ value: 254_451_000, asOf: ["2026-06-30"] });
    expect(i.core.netDebt).toMatchObject({ value: -254_451_000, asOf: ["2026-06-30"] });
    // Official NAV uses the bulletin net cash, not the statement position.
    const vale = pf.components.find(x => x.kind === "investment")!.value;
    expect(vale + pf.publishedNetCash!.value).toBe(pf.officialPortfolioValue);
    expect(vale - st.netDebt!).not.toBe(pf.officialPortfolioValue);
    expect(pf.components.find(x => x.kind === "net_cash")!.value).toBe(pf.publishedNetCash!.value);
  });

  it("indicators recomputed without the portfolio keep the statement figures unchanged", () => {
    const c = readHoldingCache("BRAP4")!;
    const noPortfolio = computeHoldingIndicators(c.statements, null);
    expect(noPortfolio.core.holdingCash.value).toBe(i.core.holdingCash.value);
    expect(noPortfolio.core.netDebt.value).toBe(i.core.netDebt.value);
  });
});

describe("indicator set", () => {
  it("is exactly the approved set — no industrial metric, headline P/L or valuation", () => {
    const i = indicators("ITSA4");
    expect(Object.keys(i.core)).toEqual([
      "officialPortfolioValue", "listedInvestmentValue", "unlistedInvestmentValue", "largestInvesteeConcentration",
      "holdingCash", "grossDebt", "netDebt", "dividendsReceivedTtm", "generalAdministrativeExpensesTtm",
      "equityMethodIncomeTtm", "netDebtToOfficialPortfolioValue", "officialMarketValue", "officialDiscount",
    ]);
    expect(Object.keys(i.secondary)).toEqual([
      "equity", "netIncomeTtm", "financialExpensesTtm", "dividendsReceivedToFinancialExpenses",
      "grossDebtToDividendsReceived", "generalAdministrativeExpensesToDividendsReceived", "standardizedClassWeightedMarketCap",
    ]);
  });

  it("missing inputs give null, never zero", () => {
    const empty = computeHoldingIndicators([], null);
    for (const v of [...Object.values(empty.core), ...Object.values(empty.secondary)]) expect(v.value).toBeNull();
    expect(holdingNetDebt({ grossDebt: 10, cash: null })).toBeNull();
  });
});
