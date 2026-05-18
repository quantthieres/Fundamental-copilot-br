import { describe, it, expect } from "vitest";
import {
  hasBankAnalysisCache,
  getBankCoverageReason,
  getBankCoverageLabel,
  BANK_CACHE_COUNT,
  BANK_BADGE,
} from "./bank-coverage";

describe("hasBankAnalysisCache", () => {
  it("returns true for known cached tickers", () => {
    for (const t of ["ITUB4", "BBDC4", "BBAS3", "SANB11", "BPAC11", "BRSR6"]) {
      expect(hasBankAnalysisCache(t), t).toBe(true);
    }
  });

  it("returns false for industrial tickers", () => {
    for (const t of ["WEGE3", "PETR4", "VALE3", "MGLU3"]) {
      expect(hasBankAnalysisCache(t), t).toBe(false);
    }
  });

  it("returns false for FII tickers", () => {
    expect(hasBankAnalysisCache("MXRF11")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(hasBankAnalysisCache("itub4")).toBe(true);
    expect(hasBankAnalysisCache("Bbas3")).toBe(true);
  });

  it("returns false for unknown ticker", () => {
    expect(hasBankAnalysisCache("XXXX9")).toBe(false);
  });
});

describe("getBankCoverageReason", () => {
  it("returns bank analysis reason for cached ticker", () => {
    const reason = getBankCoverageReason("ITUB4");
    expect(reason).toContain("Análise bancária anual");
    expect(reason).toContain("CVM");
  });

  it("returns in-development reason for non-cached bank ticker", () => {
    const reason = getBankCoverageReason("UNKB4");
    expect(reason).toContain("desenvolvimento");
  });

  it("never contains valuation language", () => {
    const r1 = getBankCoverageReason("ITUB4");
    const r2 = getBankCoverageReason("UNKB4");
    for (const word of ["valuation", "alvo", "recomendação", "compra", "venda", "DCF"]) {
      expect(r1).not.toContain(word);
      expect(r2).not.toContain(word);
    }
  });
});

describe("getBankCoverageLabel", () => {
  it("returns 'Modelo bancário' for cached tickers", () => {
    expect(getBankCoverageLabel("ITUB4")).toBe("Modelo bancário");
    expect(getBankCoverageLabel("BBDC4")).toBe("Modelo bancário");
  });

  it("returns 'Modelo específico' for non-cached tickers", () => {
    expect(getBankCoverageLabel("UNKB4")).toBe("Modelo específico");
  });
});

describe("BANK_CACHE_COUNT", () => {
  it("is a positive integer matching the number of cached tickers", () => {
    expect(BANK_CACHE_COUNT).toBeGreaterThan(0);
    expect(Number.isInteger(BANK_CACHE_COUNT)).toBe(true);
    // At minimum the 6 banks currently in cache
    expect(BANK_CACHE_COUNT).toBeGreaterThanOrEqual(6);
  });
});

describe("BANK_BADGE", () => {
  it("has required badge fields", () => {
    expect(BANK_BADGE.label).toBe("Modelo bancário");
    expect(BANK_BADGE.bg).toBeTruthy();
    expect(BANK_BADGE.color).toBeTruthy();
  });
});
