import { describe, it, expect } from "vitest";
import {
  hasFiiAnalysisCache,
  FII_CACHE_COUNT,
  getFiiCoverageLabel,
  getFiiCoverageReason,
} from "./fii-coverage";

describe("hasFiiAnalysisCache", () => {
  it("returns true for known cached FII tickers", () => {
    for (const t of ["MXRF11", "XPML11", "HGLG11", "KNRI11", "VISC11", "IRDM11", "KNCR11", "HGRE11"]) {
      expect(hasFiiAnalysisCache(t), t).toBe(true);
    }
  });

  it("returns false for BCFF11 (available:false cache)", () => {
    expect(hasFiiAnalysisCache("BCFF11")).toBe(false);
  });

  it("returns false for non-FII tickers", () => {
    expect(hasFiiAnalysisCache("WEGE3")).toBe(false);
    expect(hasFiiAnalysisCache("ITUB4")).toBe(false);
    expect(hasFiiAnalysisCache("IVVB11")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(hasFiiAnalysisCache("mxrf11")).toBe(true);
    expect(hasFiiAnalysisCache("Hglg11")).toBe(true);
  });
});

describe("FII_CACHE_COUNT", () => {
  it("does not include BCFF11", () => {
    // BCFF11 has available:false — must not count as a model-covered ticker
    expect(FII_CACHE_COUNT).toBe(8);
  });
});

describe("getFiiCoverageLabel", () => {
  it("returns Modelo de FII for cached ticker", () => {
    expect(getFiiCoverageLabel("MXRF11")).toBe("Modelo de FII");
  });

  it("returns Modelo específico for uncached ticker", () => {
    expect(getFiiCoverageLabel("BCFF11")).toBe("Modelo específico");
  });
});

describe("getFiiCoverageReason", () => {
  it("includes 'fundos imobiliários' for cached ticker", () => {
    expect(getFiiCoverageReason("MXRF11")).toContain("fundos imobiliários");
  });

  it("returns development message for uncached ticker", () => {
    expect(getFiiCoverageReason("BCFF11")).toContain("desenvolvimento");
  });
});
