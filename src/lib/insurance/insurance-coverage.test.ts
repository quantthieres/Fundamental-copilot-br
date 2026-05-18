import { describe, it, expect } from "vitest";
import {
  hasInsuranceAnalysisCache,
  INSURANCE_CACHE_COUNT,
  getInsuranceCoverageLabel,
  getInsuranceCoverageReason,
} from "./insurance-coverage";

describe("hasInsuranceAnalysisCache", () => {
  it("returns true for all active cached insurance tickers", () => {
    for (const t of ["BBSE3", "PSSA3", "IRBR3", "CXSE3"]) {
      expect(hasInsuranceAnalysisCache(t), t).toBe(true);
    }
  });

  it("returns false for SULA11 (discontinued)", () => {
    expect(hasInsuranceAnalysisCache("SULA11")).toBe(false);
  });

  it("returns false for non-insurance tickers", () => {
    expect(hasInsuranceAnalysisCache("WEGE3")).toBe(false);
    expect(hasInsuranceAnalysisCache("ITUB4")).toBe(false);
    expect(hasInsuranceAnalysisCache("MXRF11")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(hasInsuranceAnalysisCache("bbse3")).toBe(true);
    expect(hasInsuranceAnalysisCache("Pssa3")).toBe(true);
    expect(hasInsuranceAnalysisCache("sula11")).toBe(false);
  });
});

describe("INSURANCE_CACHE_COUNT", () => {
  it("reflects only active cached insurance tickers (excludes discontinued)", () => {
    expect(INSURANCE_CACHE_COUNT).toBe(4);
  });
});

describe("getInsuranceCoverageLabel", () => {
  it("returns Modelo de Seguradora for cached ticker", () => {
    expect(getInsuranceCoverageLabel("BBSE3")).toBe("Modelo de Seguradora");
  });

  it("returns Modelo específico for uncached ticker", () => {
    expect(getInsuranceCoverageLabel("UNKN3")).toBe("Modelo específico");
  });
});

describe("getInsuranceCoverageReason", () => {
  it("returns available message for cached ticker", () => {
    expect(getInsuranceCoverageReason("BBSE3")).toContain("disponível");
  });

  it("returns development message for uncached ticker", () => {
    expect(getInsuranceCoverageReason("UNKN3")).toContain("desenvolvimento");
  });
});
