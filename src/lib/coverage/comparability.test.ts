import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { B3_UNIVERSE } from "@/data/b3-universe";
import { getPrecomputedFinancials, getPrecomputedQuarterlyFinancials } from "@/lib/cvm/precomputed-cache";
import { buildFundamentalIndicators } from "@/lib/fundamentals/indicators";
import { buildCompanyAnalysisDataFromCvm } from "@/lib/cvm/cvm-analysis-builder";
import type { NormalizedFinancials } from "@/lib/cvm/types";
import type { MarketDataQuote } from "@/lib/market-data/types";
import { GET as forecastGET } from "@/app/api/forecasting/baseline/[ticker]/route";
import {
  MIN_COMPARABLE_QUARTERS_FOR_FORECAST,
  countComparableQuarters,
  forecastSuppression,
  getComparabilityBreak,
  marketMultiplesSuppression,
} from "./comparability";
import { READINESS_DECISIONS } from "./asset-readiness";
import { getFundamentalsAlias } from "./fundamentals-alias";

const QUOTE = { ticker: "AUAU3", price: 10, change: 0, changePercent: 0, marketCap: 9_000_000_000, source: "brapi" } as unknown as MarketDataQuote;
const auau3 = () => getPrecomputedFinancials("AUAU3")!;
const fy2026 = (): NormalizedFinancials => ({ ...auau3()[2], fiscalYear: 2026, revenue: 7, ebit: 0.6, netIncome: 0.3 });

function callForecast(ticker: string) {
  return forecastGET(new NextRequest(`http://localhost/api/forecasting/baseline/${ticker}`), { params: Promise.resolve({ ticker }) });
}

describe("comparability break metadata", () => {
  it("comes from the AUAU3 readiness decision and is absent elsewhere", () => {
    expect(getComparabilityBreak("AUAU3")).toBe(READINESS_DECISIONS.AUAU3.comparabilityBreak);
    expect(getComparabilityBreak("auau3")).toMatchObject({ lastPreBreakFiscalYear: 2025, firstComparableQuarter: { fiscalYear: 2026, quarter: 1 } });
    expect(getComparabilityBreak("AUAU3")!.notePt).toContain("Cobasi");
    for (const t of ["BRAV3", "BTHF11", "WEGE3", "PETZ3", null, undefined]) expect(getComparabilityBreak(t)).toBeNull();
  });

  it("does not alias, backfill or synthesize PETZ3 history", () => {
    expect(getFundamentalsAlias("AUAU3")).toBeNull();
    expect(auau3().every(f => f.ticker === "AUAU3")).toBe(true);
    expect(auau3().map(f => f.fiscalYear)).toEqual([2023, 2024, 2025]);
  });
});

describe("market multiples rule (latest annual year ≤ last pre-break year)", () => {
  it("suppresses while the latest DFP predates the combination; lifts with the FY2026 DFP", () => {
    expect(marketMultiplesSuppression("AUAU3", auau3())).not.toBeNull();
    expect(marketMultiplesSuppression("AUAU3", [])).not.toBeNull();
    expect(marketMultiplesSuppression("AUAU3", [...auau3(), fy2026()])).toBeNull();
    expect(marketMultiplesSuppression("BRAV3", getPrecomputedFinancials("BRAV3")!)).toBeNull();
  });

  it("buildFundamentalIndicators keeps market cap and history, drops mixed ratios", () => {
    const ind = buildFundamentalIndicators(auau3(), QUOTE, "AUAU3");
    expect(ind.market).toMatchObject({ marketCapB: 9, enterpriseValueB: null, pe: null, evOverEbit: null, evOverRevenue: null });
    expect(ind.market.comparabilityNote).toContain("Cobasi");
    expect(ind.cashConversion.fcfYield).toBeNull();
    expect(ind.margins.ebitMargin).not.toBeNull();      // statement-only metrics stay
    expect(ind.growth.revenueGrowthYoY).not.toBeNull();
    // Falls back to the records' ticker when the caller passes none.
    expect(buildFundamentalIndicators(auau3(), QUOTE).market.pe).toBeNull();
  });

  it("multiples return once a combined fiscal year exists, and BRAV3 is unaffected", () => {
    expect(buildFundamentalIndicators([...auau3(), fy2026()], QUOTE, "AUAU3").market.pe).toBeCloseTo(30);
    const brav = buildFundamentalIndicators(getPrecomputedFinancials("BRAV3")!, { ...QUOTE, ticker: "BRAV3" }, "BRAV3");
    expect(brav.market.pe).not.toBeNull();
    expect(brav.market.comparabilityNote).toBeNull();
  });

  it("the CVM dashboard keeps quote, market cap and statements but no P/L, EV/EBIT or EV", () => {
    const b3Entry = B3_UNIVERSE.find(a => a.ticker === "AUAU3")!;
    const data = buildCompanyAnalysisDataFromCvm({ b3Entry, cvmFinancials: auau3(), marketQuote: QUOTE })!;
    expect(data.company).toMatchObject({ ticker: "AUAU3", price: 10, marketCap: "R$ 9,0B", enterpriseValue: "—" });
    const labels = data.metrics.map(m => m.label);
    expect(labels).toContain("Valor de Mercado");
    expect(labels).toContain("Receita");
    expect(labels).not.toContain("P/L");
    expect(labels).not.toContain("EV/EBIT");
    expect(data.financials).toHaveLength(3);
  });
});

describe("forecast rule (post-break quarters < MIN_COMPARABLE_QUARTERS_FOR_FORECAST)", () => {
  const q = (fiscalYear: number, quarter: number) => ({ fiscalYear, quarter });

  it("counts only quarters from 2026Q1", () => {
    expect(countComparableQuarters("AUAU3", [q(2025, 4), q(2026, 1), q(2026, 2), q(2027, 1)])).toBe(3);
    expect(countComparableQuarters("BRAV3", [q(2026, 1)])).toBeNull();
  });

  it("threshold: 7 post-break quarters suppress, 8 serve", () => {
    expect(MIN_COMPARABLE_QUARTERS_FOR_FORECAST).toBe(8);
    const seven = [1, 2, 3, 4].map(n => q(2026, n)).concat([1, 2, 3].map(n => q(2027, n)));
    expect(forecastSuppression("AUAU3", seven)).not.toBeNull();
    expect(forecastSuppression("AUAU3", [...seven, q(2027, 4)])).toBeNull();
  });

  it("the cached AUAU3 history (2 combined quarters) is suppressed", () => {
    const quarters = getPrecomputedQuarterlyFinancials("AUAU3")!;
    expect(countComparableQuarters("AUAU3", quarters)).toBe(2);
    expect(forecastSuppression("AUAU3", quarters)).toContain("Cobasi");
  });

  it("GET /api/forecasting/baseline/AUAU3 → 409 with the note; BRAV3 still served", async () => {
    const res = await callForecast("AUAU3");
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ available: false, ticker: "AUAU3", suppressed: "comparability_break" });
    const brav = await callForecast("BRAV3");
    expect(brav.status).toBe(200);
    expect((await brav.json()).ticker).toBe("BRAV3");
  });
});
