import { describe, it, expect } from "vitest";
import { B3_UNIVERSE } from "@/data/b3-universe";
import {
  FII_MIN_DISTRIBUTION_MONTHS,
  READINESS_DECISIONS,
  classifyAssetReadiness,
  groupModelProjects,
  type ReadinessInput,
} from "./asset-readiness";
import { assessAssetReadiness } from "./asset-readiness-inputs";
import { getIssuerKey } from "./issuer-identity";
import { getTickerLifecycle } from "./ticker-lifecycle";
import { getFundamentalsAlias } from "./fundamentals-alias";

function input(over: Partial<ReadinessInput>): ReadinessInput {
  return {
    ticker: "TEST3", companyName: "Test S.A.", coverageStatus: "cvm_analysis",
    richType: "common_stock", route: "industrial", lifecycle: null, successorInUniverse: false,
    alias: null, annualYears: 6, hasQuarterly: true, decision: null, ...over,
  };
}

describe("classifyAssetReadiness — bucket assignment", () => {
  it("industrial with ≥2 years → analysis_ready", () => {
    expect(classifyAssetReadiness(input({})).readiness).toBe("analysis_ready");
  });

  it("industrial with a one-year (or empty) cache → analysis_limited", () => {
    expect(classifyAssetReadiness(input({ annualYears: 1 })).readiness).toBe("analysis_limited");
    expect(classifyAssetReadiness(input({ annualYears: 0 })).readiness).toBe("analysis_limited");
  });

  it("industrial without any cache → cache_pending", () => {
    expect(classifyAssetReadiness(input({ annualYears: null })).readiness).toBe("cache_pending");
  });

  it("a fallback route that renders is NOT analysis_ready", () => {
    for (const route of ["quote_only", "sector_specific_pending"] as const) {
      const r = classifyAssetReadiness(input({ route, coverageStatus: "quote_only", annualYears: null }));
      expect(r.readiness).not.toBe("analysis_ready");
    }
  });

  it("ETF/BDR → informational_ready", () => {
    for (const richType of ["etf", "bdr"] as const) {
      expect(classifyAssetReadiness(input({ richType, route: "informational_instrument" })).readiness).toBe("informational_ready");
    }
  });

  it("bank/FII/insurance with cache → analysis_ready; without → cache_pending", () => {
    expect(classifyAssetReadiness(input({ richType: "bank", route: "bank" })).readiness).toBe("analysis_ready");
    expect(classifyAssetReadiness(input({ richType: "fii", route: "sector_specific_pending" })).readiness).toBe("cache_pending");
  });

  it("explicit decisions: manual review, intentionally limited, model pending", () => {
    expect(classifyAssetReadiness(input({ route: "quote_only", decision: READINESS_DECISIONS.VAMO3 })).readiness).toBe("manual_review");
    expect(classifyAssetReadiness(input({ route: "quote_only", decision: READINESS_DECISIONS.CASH3 })).readiness).toBe("intentionally_limited");
    const realEstate = classifyAssetReadiness(input({ route: "quote_only", decision: READINESS_DECISIONS.ALOS3 }));
    expect(realEstate).toMatchObject({ readiness: "model_pending", modelProject: "real_estate" });
  });

  it("holding route: ready / limited / unusable cache → analysis_ready / analysis_limited / cache_pending", () => {
    const holding = (holdingCache: ReadinessInput["holdingCache"]) =>
      classifyAssetReadiness(input({ ticker: "ITSA3", richType: "holding", route: "holding", annualYears: null, holdingCache }));
    expect(holding({ status: "ready", canonicalTicker: "ITSA4", reasons: [] }))
      .toMatchObject({ readiness: "analysis_ready", fundamentalsTicker: "ITSA4" });
    expect(holding({ status: "limited", canonicalTicker: "ITSA4", reasons: ["portfolio stale (lag 2 quarter(s) behind the latest statement)"] }))
      .toMatchObject({ readiness: "analysis_limited", reason: expect.stringContaining("stale") });
    expect(holding({ status: "unusable", canonicalTicker: "ITSA4", reasons: ["holding cache ITSA4 missing or unreadable"] }).readiness).toBe("cache_pending");
    expect(holding(null).readiness).toBe("cache_pending");
    // A holding whose issuer cache is not registered routes as sector_specific_pending → cache_pending, never model_pending.
    expect(classifyAssetReadiness(input({ richType: "holding", route: "sector_specific_pending" })).readiness).toBe("cache_pending");
  });

  it("FII distribution coverage: below 12 of 12 months → limited, at 12 → ready (automatic)", () => {
    expect(FII_MIN_DISTRIBUTION_MONTHS).toBe(12);
    const fii = (n: number | null) => classifyAssetReadiness(input({ richType: "fii", route: "fii", fiiDistributionMonths: n }));
    expect(fii(6)).toMatchObject({ readiness: "analysis_limited", nextAction: expect.stringContaining("fii:precompute") });
    expect(fii(11).readiness).toBe("analysis_limited");
    expect(fii(0).readiness).toBe("analysis_limited");
    expect(fii(12).readiness).toBe("analysis_ready");
    expect(fii(null).readiness).toBe("analysis_ready");
  });

  it("FII readiness needs 12/12 coverage AND a fresh distribution (lag ≤ 1 month vs NAV)", () => {
    const fii = (months: number, lag: number | null) =>
      classifyAssetReadiness(input({ richType: "fii", route: "fii", fiiDistributionMonths: months, fiiDistributionLagMonths: lag }));
    expect(fii(12, 0).readiness).toBe("analysis_ready");
    expect(fii(12, 1).readiness).toBe("analysis_ready");      // NAV 2026-10 / dist 2026-09
    expect(fii(12, -1).readiness).toBe("analysis_ready");     // dist newer than NAV
    expect(fii(12, 2)).toMatchObject({                         // NAV 2026-11 / dist 2026-09
      readiness: "analysis_limited",
      reason: "FII latest distribution is 2 months behind the latest NAV month (max 1)",
    });
    expect(fii(11, 0).readiness).toBe("analysis_limited");
  });

  it("FII rule measures availability, not positivity: a stored zero distribution counts", async () => {
    const { computeFiiIndicators } = await import("@/lib/fiis/fii-indicators");
    const rec = (m: number, d: number | null) => ({
      ticker: "TEST11", referenceDate: `2025-${String(m).padStart(2, "0")}-01`, netAssetValue: 1,
      quotaCount: 1, netAssetValuePerShare: 10, monthlyDistributionPerShare: d, source: "fii_cvm_cache" as const,
    });
    const months = Array.from({ length: 12 }, (_, i) => rec(i + 1, i === 0 ? 0 : 0.1));
    expect(computeFiiIndicators(months, null)!.distributionCoverageMonths).toBe(12);
    months[0] = rec(1, null);
    expect(computeFiiIndicators(months, null)!.distributionCoverageMonths).toBe(11);
    // The rule never turns an existing cache into cache_pending, and banks are unaffected.
    expect(classifyAssetReadiness(input({ richType: "bank", route: "bank", fiiDistributionMonths: 0 })).readiness).toBe("analysis_ready");
  });

  it("an analysis_limited decision qualifies an existing industrial cache only", () => {
    const d = READINESS_DECISIONS.AUAU3;
    expect(classifyAssetReadiness(input({ decision: d }))).toMatchObject({ readiness: "analysis_limited", nextAction: d.nextAction });
    // Without data the decision cannot hide a missing cache.
    expect(classifyAssetReadiness(input({ decision: d, annualYears: null })).readiness).toBe("cache_pending");
    expect(classifyAssetReadiness(input({ decision: d, route: "quote_only", annualYears: null })).readiness).toBe("cache_pending");
  });

  it("historical ticker → historical_or_unavailable, even with a cache or a decision", () => {
    const lifecycle = { ticker: "OLD3", status: "renamed" as const, successorTicker: "NEW3", verification: "verified" as const, evidence: "x".repeat(30) };
    const r = classifyAssetReadiness(input({ coverageStatus: "unavailable", route: "unavailable", lifecycle, successorInUniverse: true, decision: READINESS_DECISIONS.VAMO3 }));
    expect(r).toMatchObject({ readiness: "historical_or_unavailable", successorTicker: "NEW3" });
  });

  it("historical ticker whose successor is missing → current_ticker_missing", () => {
    const lifecycle = { ticker: "OLD3", status: "renamed" as const, successorTicker: "NEW3", verification: "verified" as const, evidence: "x".repeat(30) };
    const r = classifyAssetReadiness(input({ coverageStatus: "unavailable", route: "unavailable", lifecycle, successorInUniverse: false }));
    expect(r.readiness).toBe("current_ticker_missing");
    expect(r.nextAction).toContain("NEW3");
  });

  it("industrial review flags never change the bucket", () => {
    const r = classifyAssetReadiness(input({ ticker: "MULT3" }));
    expect(r.readiness).toBe("analysis_ready");
    expect(r.reviewFlag?.modelProject).toBe("real_estate");
  });
});

describe("model projects are grouped by issuer, not ticker", () => {
  it("pending projects group by issuer; the holding project keeps only industrial review candidates", () => {
    const results = ["ALOS3", "B3SA3", "VAMO3"].map(t =>
      classifyAssetReadiness(input({ ticker: t, route: "quote_only", decision: READINESS_DECISIONS[t] })));
    results.push(classifyAssetReadiness(input({ ticker: "GOAU4" })));
    const projects = groupModelProjects(results, t => ({ key: getIssuerKey(t), name: t }));
    expect(projects.get("real_estate")!.size).toBe(1);
    expect(projects.get("market_infrastructure")!.size).toBe(1);
    expect([...projects.get("holding")!.values()]).toEqual([{ name: "GOAU4", tickers: ["GOAU4"], reviewOnly: true }]);
  });
});

describe("current universe (stable, decision/lifecycle-driven expectations)", () => {
  const r = (t: string) => assessAssetReadiness(B3_UNIVERSE.find(a => a.ticker === t)!);

  it("bank share-class aliases are analysis-ready through the canonical cache", () => {
    expect(r("ITUB3")).toMatchObject({ readiness: "analysis_ready", fundamentalsTicker: "ITUB4" });
    expect(r("BBDC3")).toMatchObject({ readiness: "analysis_ready", fundamentalsTicker: "BBDC4" });
    expect(r("ITUB4").fundamentalsTicker).toBeUndefined();
  });

  it("all four holding share classes are analysis_ready through their issuer cache", () => {
    for (const t of ["ITSA3", "ITSA4", "BRAP3", "BRAP4"]) {
      expect(r(t), t).toMatchObject({ readiness: "analysis_ready", reason: expect.stringContaining("holding model") });
      expect(READINESS_DECISIONS[t], t).toBeUndefined();
    }
    expect(r("ITSA3").fundamentalsTicker).toBe("ITSA4");
    expect(r("BRAP3").fundamentalsTicker).toBe("BRAP4");
    expect(r("ITSA4").fundamentalsTicker).toBeUndefined();
    // Holding issuer caches are not generic fundamentals aliases (no quote aliasing).
    expect(getFundamentalsAlias("ITSA3")).toBeNull();
    expect(getFundamentalsAlias("BRAP3")).toBeNull();
  });

  it("BCFF11 placeholder is historical; BTHF11 is ready once Fundos.Net fills its distributions", () => {
    expect(r("BCFF11")).toMatchObject({ readiness: "historical_or_unavailable", successorTicker: "BTHF11" });
    expect(r("BTHF11").readiness).toBe("analysis_ready");
    expect(r("BTHF11").fundamentalsTicker).toBeUndefined();
  });

  it("FIIs with 12/12 distribution months are analysis_ready", () => {
    for (const t of ["MXRF11", "XPML11", "HGLG11", "KNRI11", "VISC11", "KNCR11", "HGRE11", "BTHF11", "IRIM11"]) {
      expect(r(t).readiness, t).toBe("analysis_ready");
    }
  });

  it("decision-driven buckets", () => {
    expect(r("CASH3").readiness).toBe("intentionally_limited");
    for (const t of ["VAMO3", "SEQL3", "AMBP3", "BHIA3", "AZUL3"]) expect(r(t).readiness, t).toBe("manual_review");
    for (const t of ["ALOS3", "B3SA3"]) expect(r(t).readiness, t).toBe("model_pending");
  });

  it("ETFs/BDRs are informational_ready and every asset gets exactly one bucket", () => {
    expect(r("BOVA11").readiness).toBe("informational_ready");
    expect(r("JBSS32").readiness).toBe("informational_ready");
    const all = B3_UNIVERSE.map(a => assessAssetReadiness(a));
    expect(all).toHaveLength(B3_UNIVERSE.length);
    expect(all.filter(x => x.readiness === "current_ticker_missing")).toEqual([]);
  });

  it("decisions only target active, non-aliased universe tickers", () => {
    for (const t of Object.keys(READINESS_DECISIONS)) {
      expect(B3_UNIVERSE.some(a => a.ticker === t), t).toBe(true);
      expect(getTickerLifecycle(t), t).toBeNull();
      if (t !== "AZUL3") expect(getFundamentalsAlias(t), t).toBeNull();
    }
  });
});
