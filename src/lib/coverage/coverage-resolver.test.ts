import { describe, it, expect } from "vitest";
import { resolveAssetCoverage } from "./coverage-resolver";
import type { CoverageResolverInput } from "./coverage-resolver";
import { B3_UNIVERSE } from "@/data/b3-universe";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ALL_CACHES: Omit<CoverageResolverInput, "ticker" | "assetType" | "companyName" | "sector"> = {
  hasMarketData:         true,
  hasCvmCompany:         true,
  hasAnnualFinancials:   true,
  hasQuarterlyFinancials: true,
  hasTimeSeries:         true,
  hasBaselineForecast:   true,
};

const NO_DATA: Omit<CoverageResolverInput, "ticker" | "assetType" | "companyName" | "sector"> = {
  hasMarketData:         false,
  hasCvmCompany:         false,
  hasAnnualFinancials:   false,
  hasQuarterlyFinancials: false,
  hasTimeSeries:         false,
  hasBaselineForecast:   false,
};

const MARKET_ONLY: Omit<CoverageResolverInput, "ticker" | "assetType" | "companyName" | "sector"> = {
  hasMarketData:         true,
  hasCvmCompany:         false,
  hasAnnualFinancials:   false,
  hasQuarterlyFinancials: false,
  hasTimeSeries:         false,
  hasBaselineForecast:   false,
};

// ─── full_analysis ────────────────────────────────────────────────────────────

describe("full_analysis — all caches present", () => {
  it("common_stock with all caches → full_analysis", () => {
    const p = resolveAssetCoverage({ ticker: "WEGE3", assetType: "common_stock", ...ALL_CACHES });
    expect(p.coverageLevel).toBe("full_analysis");
    expect(p.reasonCode).toBe("HAS_FULL_CVM_AND_FORECAST");
    expect(p.isIndustrialModelEligible).toBe(true);
    expect(p.isForecastEligible).toBe(true);
  });

  it("preferred_stock with all caches → full_analysis", () => {
    const p = resolveAssetCoverage({ ticker: "PETR4", assetType: "preferred_stock", ...ALL_CACHES });
    expect(p.coverageLevel).toBe("full_analysis");
    expect(p.isIndustrialModelEligible).toBe(true);
    expect(p.isForecastEligible).toBe(true);
  });

  it("unit (KLBN11) with all caches → full_analysis", () => {
    const p = resolveAssetCoverage({ ticker: "KLBN11", assetType: "unit", ...ALL_CACHES });
    expect(p.coverageLevel).toBe("full_analysis");
    expect(p.isIndustrialModelEligible).toBe(true);
  });
});

// ─── cvm_analysis ────────────────────────────────────────────────────────────

describe("cvm_analysis — annual + quarterly, no forecast", () => {
  it("annual + quarterly but no time-series/forecast → cvm_analysis", () => {
    const p = resolveAssetCoverage({
      ticker: "EMBR3",
      assetType: "common_stock",
      hasMarketData: true,
      hasCvmCompany: true,
      hasAnnualFinancials: true,
      hasQuarterlyFinancials: true,
      hasTimeSeries: false,
      hasBaselineForecast: false,
    });
    expect(p.coverageLevel).toBe("cvm_analysis");
    expect(p.reasonCode).toBe("HAS_CVM_FINANCIALS");
    expect(p.isForecastEligible).toBe(false);
  });

  it("annual + time-series only → cvm_analysis", () => {
    const p = resolveAssetCoverage({
      ticker: "TUPY3",
      assetType: "common_stock",
      hasMarketData: true,
      hasCvmCompany: true,
      hasAnnualFinancials: true,
      hasQuarterlyFinancials: false,
      hasTimeSeries: true,
      hasBaselineForecast: false,
    });
    expect(p.coverageLevel).toBe("cvm_analysis");
  });
});

// ─── cvm_financials ───────────────────────────────────────────────────────────

describe("cvm_financials — CVM exists, no quarterly/forecast pipeline", () => {
  it("annual only → cvm_financials", () => {
    const p = resolveAssetCoverage({
      ticker: "SBSP3",
      assetType: "common_stock",
      hasMarketData: true,
      hasCvmCompany: true,
      hasAnnualFinancials: true,
      hasQuarterlyFinancials: false,
      hasTimeSeries: false,
      hasBaselineForecast: false,
    });
    expect(p.coverageLevel).toBe("cvm_financials");
    expect(p.reasonCode).toBe("HAS_CVM_BUT_LIMITED_METRICS");
  });

  it("CVM company mapped but no cache yet → cvm_financials", () => {
    const p = resolveAssetCoverage({
      ticker: "NEWT3",
      assetType: "common_stock",
      hasMarketData: true,
      hasCvmCompany: true,
      hasAnnualFinancials: false,
      hasQuarterlyFinancials: false,
      hasTimeSeries: false,
      hasBaselineForecast: false,
    });
    expect(p.coverageLevel).toBe("cvm_financials");
  });
});

// ─── quote_only ───────────────────────────────────────────────────────────────

describe("quote_only — market data only", () => {
  it("market data only, no CVM → quote_only", () => {
    const p = resolveAssetCoverage({ ticker: "LEVE3", assetType: "common_stock", ...MARKET_ONLY });
    expect(p.coverageLevel).toBe("quote_only");
    expect(p.reasonCode).toBe("NO_CVM_MAPPING");
    expect(p.isIndustrialModelEligible).toBe(true);
  });
});

// ─── sector_specific_model_required ──────────────────────────────────────────

describe("sector_specific_model_required", () => {
  it("bank → BANK_MODEL_REQUIRED", () => {
    const p = resolveAssetCoverage({ ticker: "ITUB4", assetType: "bank", ...MARKET_ONLY });
    expect(p.coverageLevel).toBe("sector_specific_model_required");
    expect(p.reasonCode).toBe("BANK_MODEL_REQUIRED");
    expect(p.isIndustrialModelEligible).toBe(false);
    expect(p.isForecastEligible).toBe(false);
  });

  it("insurance → INSURANCE_MODEL_REQUIRED", () => {
    const p = resolveAssetCoverage({ ticker: "BBSE3", assetType: "insurance", ...MARKET_ONLY });
    expect(p.coverageLevel).toBe("sector_specific_model_required");
    expect(p.reasonCode).toBe("INSURANCE_MODEL_REQUIRED");
  });

  it("fii → FII_MODEL_REQUIRED", () => {
    const p = resolveAssetCoverage({ ticker: "MXRF11", assetType: "fii", ...MARKET_ONLY });
    expect(p.coverageLevel).toBe("sector_specific_model_required");
    expect(p.reasonCode).toBe("FII_MODEL_REQUIRED");
    expect(p.isIndustrialModelEligible).toBe(false);
  });

  it("etf → ETF_MODEL_REQUIRED", () => {
    const p = resolveAssetCoverage({ ticker: "IVVB11", assetType: "etf", ...MARKET_ONLY });
    expect(p.coverageLevel).toBe("sector_specific_model_required");
    expect(p.reasonCode).toBe("ETF_MODEL_REQUIRED");
    expect(p.isIndustrialModelEligible).toBe(false);
  });

  it("bdr → BDR_MODEL_REQUIRED", () => {
    const p = resolveAssetCoverage({ ticker: "AAPL34", assetType: "bdr", ...MARKET_ONLY });
    expect(p.coverageLevel).toBe("sector_specific_model_required");
    expect(p.reasonCode).toBe("BDR_MODEL_REQUIRED");
    expect(p.isIndustrialModelEligible).toBe(false);
  });

  it("financial → UNKNOWN_ASSET_TYPE → sector_specific_model_required", () => {
    const p = resolveAssetCoverage({ ticker: "ITSA4", assetType: "financial", ...MARKET_ONLY });
    expect(p.coverageLevel).toBe("sector_specific_model_required");
    expect(p.reasonCode).toBe("UNKNOWN_ASSET_TYPE");
  });

  it("bank with ALL_CACHES still → sector_specific (data ignored)", () => {
    const p = resolveAssetCoverage({ ticker: "BBAS3", assetType: "bank", ...ALL_CACHES });
    expect(p.coverageLevel).toBe("sector_specific_model_required");
    expect(p.isForecastEligible).toBe(false);
  });
});

// ─── unavailable ──────────────────────────────────────────────────────────────

describe("unavailable — no data at all", () => {
  it("no market data, no CVM → unavailable", () => {
    const p = resolveAssetCoverage({ ticker: "UNKN3", assetType: "common_stock", ...NO_DATA });
    expect(p.coverageLevel).toBe("unavailable");
    expect(p.reasonCode).toBe("NO_MARKET_DATA");
  });

  it("unknown assetType, no data → sector_specific_model_required", () => {
    const p = resolveAssetCoverage({ ticker: "ZZZZ3", assetType: "unknown", ...NO_DATA });
    expect(p.coverageLevel).toBe("sector_specific_model_required");
    expect(p.reasonCode).toBe("UNKNOWN_ASSET_TYPE");
  });
});

// ─── declared unavailable precedence ─────────────────────────────────────────

describe("declaredStatus unavailable — authoritative over cache-derived resolution", () => {
  it("obsolete stock with market data → unavailable (PETZ3-like)", () => {
    const p = resolveAssetCoverage({
      ticker: "PETZ3", assetType: "common_stock", ...MARKET_ONLY, declaredStatus: "unavailable",
    });
    expect(p.coverageLevel).toBe("unavailable");
    expect(p.reasonCode).toBe("DECLARED_UNAVAILABLE");
    expect(p.isIndustrialModelEligible).toBe(false);
    expect(p.isForecastEligible).toBe(false);
  });

  it("incorporated insurer → unavailable, not sector-specific (SULA11-like)", () => {
    const p = resolveAssetCoverage({
      ticker: "SULA11", assetType: "insurance", ...MARKET_ONLY, declaredStatus: "unavailable",
    });
    expect(p.coverageLevel).toBe("unavailable");
    expect(p.reasonCode).toBe("DECLARED_UNAVAILABLE");
  });

  it("wins even when every cache is present", () => {
    const p = resolveAssetCoverage({
      ticker: "XXXX3", assetType: "common_stock", ...ALL_CACHES, declaredStatus: "unavailable",
    });
    expect(p.coverageLevel).toBe("unavailable");
    expect(p.isForecastEligible).toBe(false);
    // Cache flags are still reported as-is.
    expect(p.hasAnnualFinancials).toBe(true);
  });

  it("declared quote_only stays quote_only", () => {
    const p = resolveAssetCoverage({
      ticker: "BRAP4", assetType: "common_stock", ...MARKET_ONLY, declaredStatus: "quote_only",
    });
    expect(p.coverageLevel).toBe("quote_only");
    expect(p.reasonCode).toBe("NO_CVM_MAPPING");
  });

  it("declared sector-specific bank keeps sector-specific resolution", () => {
    const p = resolveAssetCoverage({
      ticker: "ITUB4", assetType: "bank", ...MARKET_ONLY, declaredStatus: "sector_specific_model_required",
    });
    expect(p.coverageLevel).toBe("sector_specific_model_required");
    expect(p.reasonCode).toBe("BANK_MODEL_REQUIRED");
  });

  it("declared cvm_analysis with all caches still resolves to full_analysis", () => {
    const p = resolveAssetCoverage({
      ticker: "AERI3", assetType: "common_stock", ...ALL_CACHES, declaredStatus: "cvm_analysis",
    });
    expect(p.coverageLevel).toBe("full_analysis");
    expect(p.isForecastEligible).toBe(true);
  });

  it("every B3_UNIVERSE asset declared unavailable resolves to unavailable", () => {
    const declared = B3_UNIVERSE.filter(a => a.coverageStatus === "unavailable");
    expect(declared.map(a => a.ticker)).toEqual(expect.arrayContaining(["PETZ3", "SULA11"]));
    for (const a of declared) {
      const p = resolveAssetCoverage({
        ticker: a.ticker, assetType: "common_stock", ...MARKET_ONLY, declaredStatus: a.coverageStatus,
      });
      expect(p.coverageLevel, a.ticker).toBe("unavailable");
    }
  });
});

// ─── Profile shape ────────────────────────────────────────────────────────────

describe("profile shape", () => {
  it("no crash on any combination of inputs", () => {
    const assetTypes: Array<CoverageResolverInput["assetType"]> = [
      "common_stock", "preferred_stock", "unit", "bank", "insurance",
      "financial", "fii", "etf", "bdr", "fund", "unknown",
    ];
    for (const assetType of assetTypes) {
      expect(() => resolveAssetCoverage({ ticker: "TEST3", assetType, ...NO_DATA })).not.toThrow();
    }
  });

  it("normalizedTicker is always uppercased and clean", () => {
    const p = resolveAssetCoverage({ ticker: "wege3", assetType: "common_stock", ...ALL_CACHES });
    expect(p.normalizedTicker).toBe("WEGE3");
  });

  it("displayMessage is a non-empty string for all reason codes", () => {
    const p = resolveAssetCoverage({ ticker: "ITUB4", assetType: "bank", ...MARKET_ONLY });
    expect(typeof p.displayMessage).toBe("string");
    expect(p.displayMessage.length).toBeGreaterThan(0);
  });

  it("companyName becomes displayTitle when provided", () => {
    const p = resolveAssetCoverage({
      ticker: "WEGE3",
      assetType: "common_stock",
      companyName: "WEG S.A.",
      ...ALL_CACHES,
    });
    expect(p.displayTitle).toBe("WEG S.A.");
  });

  it("isForecastEligible false when assetType is not industrial", () => {
    const p = resolveAssetCoverage({ ticker: "MXRF11", assetType: "fii", ...ALL_CACHES });
    expect(p.isForecastEligible).toBe(false);
  });

  it("isForecastEligible false when timeseries or forecast cache missing", () => {
    const p = resolveAssetCoverage({
      ticker: "WEGE3",
      assetType: "common_stock",
      hasMarketData: true,
      hasCvmCompany: true,
      hasAnnualFinancials: true,
      hasQuarterlyFinancials: true,
      hasTimeSeries: false,
      hasBaselineForecast: true,
    });
    expect(p.isForecastEligible).toBe(false);
  });

  it("displayMessage contains no valuation language", () => {
    const p = resolveAssetCoverage({ ticker: "WEGE3", assetType: "common_stock", ...ALL_CACHES });
    expect(p.displayMessage.toLowerCase()).not.toContain("valuation");
    expect(p.displayMessage.toLowerCase()).not.toContain("dcf");
    expect(p.displayMessage.toLowerCase()).not.toContain("preço-alvo");
    expect(p.displayMessage.toLowerCase()).not.toContain("recomendação");
  });
});
