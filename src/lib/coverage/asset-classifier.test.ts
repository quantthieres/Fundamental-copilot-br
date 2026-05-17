import { describe, it, expect } from "vitest";
import {
  normalizeTicker,
  inferAssetTypeFromTicker,
  inferAssetTypeFromKnownMappings,
  classifyAsset,
} from "./asset-classifier";

// ─── normalizeTicker ──────────────────────────────────────────────────────────

describe("normalizeTicker", () => {
  it("uppercases lowercase ticker", () => {
    expect(normalizeTicker("wege3")).toBe("WEGE3");
  });
  it("strips dots from KLBN.11 style input", () => {
    expect(normalizeTicker("KLBN.11")).toBe("KLBN11");
  });
  it("strips spaces", () => {
    expect(normalizeTicker(" PETR4 ")).toBe("PETR4");
  });
  it("already-normalized ticker is unchanged", () => {
    expect(normalizeTicker("MXRF11")).toBe("MXRF11");
  });
});

// ─── inferAssetTypeFromTicker — explicit map ──────────────────────────────────

describe("inferAssetTypeFromTicker — explicit map", () => {
  it("KLBN11 is unit (not FII)", () => {
    expect(inferAssetTypeFromTicker("KLBN11")).toBe("unit");
  });
  it("TAEE11 is unit", () => {
    expect(inferAssetTypeFromTicker("TAEE11")).toBe("unit");
  });
  it("SAPR11 is unit", () => {
    expect(inferAssetTypeFromTicker("SAPR11")).toBe("unit");
  });
  it("ALUP11 is unit", () => {
    expect(inferAssetTypeFromTicker("ALUP11")).toBe("unit");
  });
  it("MXRF11 is fii", () => {
    expect(inferAssetTypeFromTicker("MXRF11")).toBe("fii");
  });
  it("HGLG11 is fii", () => {
    expect(inferAssetTypeFromTicker("HGLG11")).toBe("fii");
  });
  it("KNRI11 is fii", () => {
    expect(inferAssetTypeFromTicker("KNRI11")).toBe("fii");
  });
  it("IVVB11 is etf", () => {
    expect(inferAssetTypeFromTicker("IVVB11")).toBe("etf");
  });
  it("BOVA11 is etf", () => {
    expect(inferAssetTypeFromTicker("BOVA11")).toBe("etf");
  });
  it("HASH11 is etf", () => {
    expect(inferAssetTypeFromTicker("HASH11")).toBe("etf");
  });
  it("AAPL34 is bdr", () => {
    expect(inferAssetTypeFromTicker("AAPL34")).toBe("bdr");
  });
  it("MSFT34 is bdr", () => {
    expect(inferAssetTypeFromTicker("MSFT34")).toBe("bdr");
  });
  it("TSLA34 is bdr", () => {
    expect(inferAssetTypeFromTicker("TSLA34")).toBe("bdr");
  });
  it("ITUB4 is bank", () => {
    expect(inferAssetTypeFromTicker("ITUB4")).toBe("bank");
  });
  it("BBDC4 is bank", () => {
    expect(inferAssetTypeFromTicker("BBDC4")).toBe("bank");
  });
  it("BBAS3 is bank", () => {
    expect(inferAssetTypeFromTicker("BBAS3")).toBe("bank");
  });
  it("SANB11 is bank (not unit, not FII)", () => {
    expect(inferAssetTypeFromTicker("SANB11")).toBe("bank");
  });
  it("BBSE3 is insurance", () => {
    expect(inferAssetTypeFromTicker("BBSE3")).toBe("insurance");
  });
  it("IRBR3 is insurance", () => {
    expect(inferAssetTypeFromTicker("IRBR3")).toBe("insurance");
  });
  it("SULA11 is insurance (not unit, not FII)", () => {
    expect(inferAssetTypeFromTicker("SULA11")).toBe("insurance");
  });
});

// ─── inferAssetTypeFromTicker — pattern inference ─────────────────────────────

describe("inferAssetTypeFromTicker — pattern inference", () => {
  it("WEGE3 suffix 3 → common_stock", () => {
    expect(inferAssetTypeFromTicker("WEGE3")).toBe("common_stock");
  });
  it("VALE3 suffix 3 → common_stock", () => {
    expect(inferAssetTypeFromTicker("VALE3")).toBe("common_stock");
  });
  it("PETR4 suffix 4 → preferred_stock", () => {
    expect(inferAssetTypeFromTicker("PETR4")).toBe("preferred_stock");
  });
  it("BRKM5 suffix 5 → preferred_stock", () => {
    expect(inferAssetTypeFromTicker("BRKM5")).toBe("preferred_stock");
  });
  it("CPLE6 suffix 6 → preferred_stock", () => {
    expect(inferAssetTypeFromTicker("CPLE6")).toBe("preferred_stock");
  });
  it("unknown 34-suffix is inferred as bdr", () => {
    expect(inferAssetTypeFromTicker("UNKN34")).toBe("bdr");
  });
  it("unknown 11-suffix is inferred as unit (ambiguous without context)", () => {
    expect(inferAssetTypeFromTicker("AMBG11")).toBe("unit");
  });
  it("no-suffix ticker → unknown", () => {
    expect(inferAssetTypeFromTicker("ABCD")).toBe("unknown");
  });
});

// ─── inferAssetTypeFromKnownMappings ─────────────────────────────────────────

describe("inferAssetTypeFromKnownMappings", () => {
  it("explicit map still takes precedence over sector", () => {
    expect(inferAssetTypeFromKnownMappings("ITUB4", undefined, "Bancário")).toBe("bank");
  });
  it("sector Bancário refines unknown stock to bank", () => {
    expect(inferAssetTypeFromKnownMappings("NEWB4", undefined, "Bancário")).toBe("bank");
  });
  it("sector Seguros refines to insurance", () => {
    expect(inferAssetTypeFromKnownMappings("SEGR3", undefined, "Seguros")).toBe("insurance");
  });
  it("company name containing FII refines to fii", () => {
    expect(inferAssetTypeFromKnownMappings("TEST11", "XYZ FII")).toBe("fii");
  });
  it("without context, falls back to ticker pattern", () => {
    expect(inferAssetTypeFromKnownMappings("NEWC3")).toBe("common_stock");
  });
});

// ─── classifyAsset ────────────────────────────────────────────────────────────

describe("classifyAsset", () => {
  it("KLBN11 is unit with B3 unit context and industrial sector", () => {
    expect(classifyAsset("KLBN11", { b3AssetType: "unit", sector: "Papel e Celulose" })).toBe("unit");
  });
  it("WEGE3 is common_stock with B3 stock context", () => {
    expect(classifyAsset("WEGE3", { b3AssetType: "stock", sector: "Bens de Capital" })).toBe("common_stock");
  });
  it("PETR4 is preferred_stock with B3 stock context", () => {
    expect(classifyAsset("PETR4", { b3AssetType: "stock", sector: "Petróleo e Gás" })).toBe("preferred_stock");
  });
  it("ITUB4 is bank regardless of B3 stock context", () => {
    expect(classifyAsset("ITUB4", { b3AssetType: "stock", sector: "Bancário" })).toBe("bank");
  });
  it("MXRF11 is fii with B3 fii context", () => {
    expect(classifyAsset("MXRF11", { b3AssetType: "fii" })).toBe("fii");
  });
  it("IVVB11 is etf with B3 etf context", () => {
    expect(classifyAsset("IVVB11", { b3AssetType: "etf" })).toBe("etf");
  });
  it("ambiguous 11-suffix unit in banking sector → bank", () => {
    expect(classifyAsset("BANK11", { b3AssetType: "unit", sector: "Bancário" })).toBe("bank");
  });
  it("ambiguous 11-suffix unit in industrial sector → unit", () => {
    expect(classifyAsset("OPER11", { b3AssetType: "unit", sector: "Energia Elétrica" })).toBe("unit");
  });
  it("unknown ticker ending in 3 → common_stock via suffix", () => {
    expect(classifyAsset("UNKN3")).toBe("common_stock");
  });
  it("unknown 34-suffix → bdr via suffix", () => {
    expect(classifyAsset("XYZW34")).toBe("bdr");
  });
  it("no crash on empty-like inputs", () => {
    expect(() => classifyAsset("A3")).not.toThrow();
  });
});
