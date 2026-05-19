import { describe, it, expect } from "vitest";
import { resolveModelRoute, type ModelRoute } from "./model-routing";
import { B3_UNIVERSE } from "@/data/b3-universe";
import type { B3Asset } from "@/data/b3-universe";

function fromUniverse(ticker: string): B3Asset {
  const a = B3_UNIVERSE.find(x => x.ticker === ticker);
  if (!a) throw new Error(`${ticker} not found in B3_UNIVERSE`);
  return a;
}

describe("resolveModelRoute", () => {

  // ── Industrial ──────────────────────────────────────────────────────────────

  it("WEGE3 → industrial", () => {
    expect(resolveModelRoute(fromUniverse("WEGE3"))).toBe<ModelRoute>("industrial");
  });

  it("PETR4 → industrial", () => {
    expect(resolveModelRoute(fromUniverse("PETR4"))).toBe<ModelRoute>("industrial");
  });

  it("ROMI3 → industrial", () => {
    expect(resolveModelRoute(fromUniverse("ROMI3"))).toBe<ModelRoute>("industrial");
  });

  // ── Banks ───────────────────────────────────────────────────────────────────

  it("ITUB4 → bank", () => {
    expect(resolveModelRoute(fromUniverse("ITUB4"))).toBe<ModelRoute>("bank");
  });

  it("BBDC4 → bank", () => {
    expect(resolveModelRoute(fromUniverse("BBDC4"))).toBe<ModelRoute>("bank");
  });

  it("BBAS3 → bank", () => {
    expect(resolveModelRoute(fromUniverse("BBAS3"))).toBe<ModelRoute>("bank");
  });

  // ── FIIs ────────────────────────────────────────────────────────────────────

  it("MXRF11 → fii", () => {
    expect(resolveModelRoute(fromUniverse("MXRF11"))).toBe<ModelRoute>("fii");
  });

  it("IRDM11 → fii", () => {
    expect(resolveModelRoute(fromUniverse("IRDM11"))).toBe<ModelRoute>("fii");
  });

  it("BCFF11 → sector_specific_pending (FII without model cache)", () => {
    expect(resolveModelRoute(fromUniverse("BCFF11"))).toBe<ModelRoute>("sector_specific_pending");
  });

  // ── Insurance ───────────────────────────────────────────────────────────────

  it("BBSE3 → insurance", () => {
    expect(resolveModelRoute(fromUniverse("BBSE3"))).toBe<ModelRoute>("insurance");
  });

  it("PSSA3 → insurance", () => {
    expect(resolveModelRoute(fromUniverse("PSSA3"))).toBe<ModelRoute>("insurance");
  });

  // ── Unavailable / discontinued ──────────────────────────────────────────────

  it("SULA11 → unavailable (discontinued, coverageStatus wins)", () => {
    expect(resolveModelRoute(fromUniverse("SULA11"))).toBe<ModelRoute>("unavailable");
  });

  // ── ETF ─────────────────────────────────────────────────────────────────────

  it("IVVB11 → sector_specific_pending (ETF, no model yet)", () => {
    expect(resolveModelRoute(fromUniverse("IVVB11"))).toBe<ModelRoute>("sector_specific_pending");
  });

  // ── BDR (synthetic — AAPL34 not in B3_UNIVERSE) ────────────────────────────

  it("AAPL34 → sector_specific_pending (BDR)", () => {
    const bdr: B3Asset = {
      ticker:         "AAPL34",
      companyName:    "Apple Inc.",
      tradingName:    "AAPL34",
      sector:         "Tecnologia",
      subsector:      "BDR",
      assetType:      "bdr",
      hasMockData:    false,
      hasCvmMapping:  false,
      coverageStatus: "sector_specific_model_required",
    };
    expect(resolveModelRoute(bdr)).toBe<ModelRoute>("sector_specific_pending");
  });

  // ── Edge cases ──────────────────────────────────────────────────────────────

  it("coverageStatus=unavailable wins regardless of richType", () => {
    // Synthetic: insurance ticker forced to unavailable — same as SULA11's state.
    const discontinued: B3Asset = {
      ticker:         "SULA11",
      companyName:    "SulAmérica S.A.",
      tradingName:    "SulAmérica",
      sector:         "Seguros",
      subsector:      "Seguro Saúde e Vida",
      assetType:      "unit",
      hasMockData:    false,
      hasCvmMapping:  false,
      coverageStatus: "unavailable",
    };
    expect(resolveModelRoute(discontinued)).toBe<ModelRoute>("unavailable");
  });

  it("quote_only industrial-eligible → quote_only", () => {
    const quoteOnly: B3Asset = {
      ticker:         "TEST3",
      companyName:    "Test S.A.",
      tradingName:    "Test",
      sector:         "Bens de Capital",
      subsector:      "Outros",
      assetType:      "stock",
      hasMockData:    false,
      hasCvmMapping:  false,
      coverageStatus: "quote_only",
    };
    expect(resolveModelRoute(quoteOnly)).toBe<ModelRoute>("quote_only");
  });

  it("ETF with quote_only status → quote_only", () => {
    const etfQuote: B3Asset = {
      ticker:         "BOVA11",
      companyName:    "iShares Ibovespa ETF",
      tradingName:    "BOVA11",
      sector:         "ETF",
      subsector:      "Índice Ibovespa",
      assetType:      "etf",
      hasMockData:    false,
      hasCvmMapping:  false,
      coverageStatus: "quote_only",
    };
    expect(resolveModelRoute(etfQuote)).toBe<ModelRoute>("quote_only");
  });
});
