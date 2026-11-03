import { describe, it, expect } from "vitest";
import {
  hasFiiAnalysisCache,
  FII_CACHE_COUNT,
  getFiiCoverageLabel,
  getFiiCoverageReason,
  getCurrentFiiCacheTickers,
} from "./fii-coverage";
import { readFiiCache } from "./fii-cache";
import { computeFiiIndicators, latestRecordWithNav } from "./fii-indicators";

describe("hasFiiAnalysisCache", () => {
  it("returns true for known cached FII tickers", () => {
    for (const t of ["MXRF11", "XPML11", "HGLG11", "KNRI11", "VISC11", "IRDM11", "KNCR11", "HGRE11", "BTHF11", "IRIM11"]) {
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
  it("counts current FIIs only: not BCFF11 (placeholder) nor IRDM11 (historical)", () => {
    // BCFF11 has available:false; IRDM11's cache is real but the fund is wound up
    expect(FII_CACHE_COUNT).toBe(9);
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

describe("current FII caches — distribution provenance", () => {
  const tickers = getCurrentFiiCacheTickers();

  it("excludes historical codes (IRDM11) from current coverage", () => {
    expect(tickers).not.toContain("IRDM11");
    expect(tickers).toHaveLength(FII_CACHE_COUNT);
  });

  it("every distribution is a Fundos.Net amount citing its notices; CVM estimates stay diagnostic", () => {
    for (const t of tickers) {
      const cache = readFiiCache(t)!;
      expect(cache.distributionEnrichment?.status, t).toBe("ok");
      for (const r of cache.records) {
        const at = `${t} ${r.referenceDate}`;
        if (r.monthlyDistributionPerShare != null) expect(r.distributionSource, at).toBe("fnet_structured");
        if (r.distributionSource === "fnet_structured") expect(r.fnetDocumentIds?.length, at).toBeGreaterThan(0);
        if (r.distributionSource == null) expect(r.monthlyDistributionPerShare, at).toBeNull();
        if (r.source === "fii_fnet_only") {
          expect([r.netAssetValue, r.quotaCount, r.netAssetValuePerShare, r.cvmDerivedDistributionEstimate], at).toEqual([null, null, null, null]);
        }
      }
    }
  });

  it("NAV comes from the latest informe even when a newer distribution-only month exists", () => {
    for (const t of tickers) {
      const records = readFiiCache(t)!.records;
      const ind = computeFiiIndicators(records, 100)!;
      const nav = latestRecordWithNav(records)!;
      expect(ind.netAssetValuePerShare, t).toBe(nav.netAssetValuePerShare);
      expect(ind.priceToBookValuePerShare, t).toBeCloseTo(100 / nav.netAssetValuePerShare!);
      expect(nav.source, t).toBe("fii_cvm_cache");
    }
  });

  it("the historical IRDM11 cache was not re-generated with the new source", () => {
    const cache = readFiiCache("IRDM11")!;
    expect(cache.distributionEnrichment).toBeUndefined();
    expect(cache.records.every(r => r.distributionSource === undefined)).toBe(true);
  });
});
