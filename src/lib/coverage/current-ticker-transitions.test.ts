// BRAV3, AUAU3 and BTHF11: current codes whose predecessors (RRRP3, PETZ3,
// BCFF11) are historical. Each is covered under its own code — no aliases.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { B3_UNIVERSE } from "@/data/b3-universe";
import { getCvmCompanyByTicker } from "@/lib/cvm/company-map";
import { getPrecomputedFinancials, getPrecomputedQuarterlyFinancials } from "@/lib/cvm/precomputed-cache";
import { hasFiiAnalysisCache } from "@/lib/fiis/fii-coverage";
import { readFiiCache } from "@/lib/fiis/fii-cache";
import {
  computeFiiIndicators,
  distributionWindowMonths,
  latestDistributionReferenceMonth,
  latestRecordWithNav,
} from "@/lib/fiis/fii-indicators";
import { assessAssetReadiness, fiiDistributionMonths } from "./asset-readiness-inputs";
import { getFundamentalsAlias, resolveFundamentalsTicker } from "./fundamentals-alias";
import { getIssuerCvmCode, isSameIssuer } from "./issuer-identity";
import { resolveModelRoute } from "./model-routing";
import { getTickerLifecycle, lifecycleHintPt } from "./ticker-lifecycle";
import { FII_MIN_DISTRIBUTION_MONTHS } from "./asset-readiness";

const asset = (t: string) => B3_UNIVERSE.find(a => a.ticker === t)!;
const readiness = (t: string) => assessAssetReadiness(asset(t));

describe("BRAV3 (former RRRP3 — same issuer, renamed)", () => {
  it("BRAV3 is current; RRRP3 stays historical", () => {
    expect(getTickerLifecycle("BRAV3")).toBeNull();
    expect(getTickerLifecycle("RRRP3")).toMatchObject({ status: "renamed", successorTicker: "BRAV3", successorRelation: "same_issuer" });
    expect(asset("RRRP3").coverageStatus).toBe("unavailable");
    expect(resolveModelRoute(asset("RRRP3"))).toBe("unavailable");
  });

  it("is mapped to Brava Energia (CD_CVM 25291), the same issuer as RRRP3", () => {
    expect(getCvmCompanyByTicker("BRAV3")).toMatchObject({ cvmCode: "25291", cnpj: "12.091.809/0001-55", hasCvmMapping: true });
    expect(getIssuerCvmCode("BRAV3")).toBe("25291");
    expect(isSameIssuer("BRAV3", "RRRP3")).toBe(true);
    expect(getCvmCompanyByTicker("RRRP3")).toBeNull(); // precompute never targets the old code
  });

  it("uses its own cache — no alias, so quote and fundamentals both stay BRAV3", () => {
    expect(getFundamentalsAlias("BRAV3")).toBeNull();
    expect(resolveFundamentalsTicker("BRAV3")).toBe("BRAV3");
    const raw = JSON.parse(readFileSync(join(process.cwd(), "src/data/cvm-cache/financials/BRAV3.json"), "utf-8"));
    expect(raw).toMatchObject({ ticker: "BRAV3", companyName: "Brava Energia S.A." });
  });

  it("is analysis-ready from its actual annual + quarterly history", () => {
    const years = getPrecomputedFinancials("BRAV3")!.map(f => f.fiscalYear);
    expect(years.length).toBeGreaterThanOrEqual(2);
    expect(new Set(years).size).toBe(years.length);
    expect(getPrecomputedQuarterlyFinancials("BRAV3")!.length).toBeGreaterThan(0);
    expect(resolveModelRoute(asset("BRAV3"))).toBe("industrial");
    expect(readiness("BRAV3")).toMatchObject({ readiness: "analysis_ready", reason: `${years.length} fiscal years + quarterly` });
  });
});

describe("AUAU3 (União Pet — new issuer, not Petz)", () => {
  it("AUAU3 is current; PETZ3 stays historical", () => {
    expect(getTickerLifecycle("AUAU3")).toBeNull();
    expect(getTickerLifecycle("PETZ3")).toMatchObject({ status: "incorporated", successorTicker: "AUAU3", successorRelation: "new_issuer" });
    expect(asset("PETZ3").coverageStatus).toBe("unavailable");
  });

  it("is mapped to União Pet (CD_CVM 27766), never to Petz (25089)", () => {
    expect(getCvmCompanyByTicker("AUAU3")).toMatchObject({ cvmCode: "27766", cnpj: "53.153.938/0001-08", hasCvmMapping: true });
    expect(isSameIssuer("AUAU3", "PETZ3")).toBe(false);
    expect(getCvmCompanyByTicker("PETZ3")).toBeNull();
  });

  it("has no PETZ3 fundamentals alias", () => {
    expect(getFundamentalsAlias("AUAU3")).toBeNull();
    expect(resolveFundamentalsTicker("AUAU3")).toBe("AUAU3");
  });

  it("annual history is the issuer's own (no triple-counted FY2023)", () => {
    const fy = getPrecomputedFinancials("AUAU3")!;
    expect(fy.map(f => f.fiscalYear)).toEqual([2023, 2024, 2025]);
    // CVM's DFP 2023 CSV repeats each line 3×; revenue must equal the filed R$ 2,582,827 mil.
    expect(fy[0].revenue).toBeCloseTo(2.582827, 6);
  });

  it("is analysis_limited: no fiscal year reflects the combined Petz/Cobasi business", () => {
    expect(resolveModelRoute(asset("AUAU3"))).toBe("industrial");
    const r = readiness("AUAU3");
    expect(r.readiness).toBe("analysis_limited");
    expect(r.reason).toContain("Cobasi standalone");
    expect(r.nextAction).toContain("FY2026");
  });
});

describe("BTHF11 (BTG Pactual Real Estate Hedge Fund — not BCFF11)", () => {
  it("BTHF11 is current; BCFF11 stays historical", () => {
    expect(getTickerLifecycle("BTHF11")).toBeNull();
    expect(getTickerLifecycle("BCFF11")).toMatchObject({ status: "incorporated", successorTicker: "BTHF11", successorRelation: "new_issuer" });
    expect(resolveModelRoute(asset("BCFF11"))).toBe("unavailable");
  });

  it("uses its own available:true cache, never the BCFF11 placeholder", () => {
    const cache = readFiiCache("BTHF11")!;
    expect(cache).toMatchObject({ ticker: "BTHF11", available: true, fund: { cnpj: "45.188.176/0001-57" } });
    expect(cache.records.length).toBeGreaterThan(0);
    expect(cache.records.every(r => r.ticker === "BTHF11")).toBe(true);
    expect(getFundamentalsAlias("BTHF11")).toBeNull();
    expect(readFiiCache("BCFF11")?.available).toBe(false);
    expect(hasFiiAnalysisCache("BCFF11")).toBe(false);
  });

  it("monthly records are chronological and unique", () => {
    const dates = readFiiCache("BTHF11")!.records.map(r => r.referenceDate);
    expect([...dates].sort()).toEqual(dates);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("routes to the FII model; readiness follows the generic distribution-coverage rule", () => {
    expect(hasFiiAnalysisCache("BTHF11")).toBe(true);
    expect(resolveModelRoute(asset("BTHF11"))).toBe("fii");
    const months = fiiDistributionMonths("BTHF11")!;
    expect(readiness("BTHF11").readiness).toBe(months >= FII_MIN_DISTRIBUTION_MONTHS ? "analysis_ready" : "analysis_limited");
  });

  it("months the CVM informe left blank are filled from Fundos.Net notices for the traded quota", () => {
    const cache = readFiiCache("BTHF11")!;
    expect(cache.distributionEnrichment).toMatchObject({ status: "ok", isin: "BRBTHFCTF000" });
    const recent = cache.records.filter(r => r.referenceDate >= "2026-04-01");
    expect(recent.length).toBeGreaterThan(0);
    for (const r of recent) {
      expect(r.cvmDerivedDistributionEstimate ?? null, r.referenceDate).toBeNull();
      expect(r, r.referenceDate).toMatchObject({ distributionSource: "fnet_structured", monthlyDistributionPerShare: expect.any(Number) });
      expect(r.fnetDocumentIds?.length, r.referenceDate).toBeGreaterThan(0);
    }
    // Dec-2025 was refiled (reapresentação 1077704 replaced 1077689: 0.092 → 0.10599).
    expect(cache.records.find(r => r.referenceDate === "2025-12-01")).toMatchObject({
      monthlyDistributionPerShare: 0.10599, fnetDocumentIds: [1077704],
    });
  });
});

describe("IRDM11 → IRIM11 (fund wound up, portfolio moved to a different fund)", () => {
  it("IRDM11 is historical with IRIM11 as successor — a reorganization, not a rename", () => {
    const lc = getTickerLifecycle("IRDM11")!;
    expect(lc).toMatchObject({ status: "reorganized", successorTicker: "IRIM11", successorRelation: "new_issuer", effectiveDate: "2025-11-28" });
    expect(lc.status).not.toBe("renamed");
    expect(asset("IRDM11").coverageStatus).toBe("unavailable");
    expect(lifecycleHintPt("IRDM11")).toBe("Código histórico · Atual: IRIM11");
  });

  it("the two funds have different CNPJs and no alias links them", () => {
    expect(readFiiCache("IRDM11")!.fund?.cnpj).toBe("28.830.325/0001-10");
    expect(readFiiCache("IRIM11")!.fund?.cnpj).toBe("41.076.564/0001-95");
    for (const t of ["IRDM11", "IRIM11"]) {
      expect(getFundamentalsAlias(t), t).toBeNull();
      expect(resolveFundamentalsTicker(t), t).toBe(t);
    }
  });

  it("IRIM11 reads its own cache, never IRDM11's", () => {
    const cache = readFiiCache("IRIM11")!;
    expect(cache).toMatchObject({ ticker: "IRIM11", available: true });
    expect(cache.records.every(r => r.ticker === "IRIM11")).toBe(true);
    const dates = cache.records.map(r => r.referenceDate);
    expect([...dates].sort()).toEqual(dates);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("IRIM11 is current, routes to the FII model and follows the generic FII-quality rule", () => {
    expect(getTickerLifecycle("IRIM11")).toBeNull();
    expect(resolveModelRoute(asset("IRIM11"))).toBe("fii");
    const months = fiiDistributionMonths("IRIM11")!;
    expect(readiness("IRIM11").readiness).toBe(months >= FII_MIN_DISTRIBUTION_MONTHS ? "analysis_ready" : "analysis_limited");
  });

  it("IRIM11 distributions come from its own Fundos.Net notices (CVM informe reported 0%)", () => {
    const cache = readFiiCache("IRIM11")!;
    expect(cache.distributionEnrichment).toMatchObject({ status: "ok", isin: "BRIRIMCTF003" });
    // Sep-2026: notice 1344822, R$0.75/cota, data base 2026-10-09, paid 2026-10-19.
    expect(cache.records.find(r => r.referenceDate === "2026-09-01")).toMatchObject({
      monthlyDistributionPerShare: 0.75,
      distributionSource: "fnet_structured",
      cvmDerivedDistributionEstimate: null,
      distributionBaseDate: "2026-10-09",
      distributionPaymentDate: "2026-10-19",
      fnetDocumentIds: [1344822],
    });
  });

  it("BTHF11 and IRIM11: separate NAV and distribution freshness; full 12-month Fundos.Net window", () => {
    for (const t of ["BTHF11", "IRIM11"]) {
      const records = readFiiCache(t)!.records;
      const ind = computeFiiIndicators(records, null)!;
      expect(ind.navReferenceDate, t).toBe(latestRecordWithNav(records)!.referenceDate);
      expect(ind.distributionReferenceDate, t).toBe(`${latestDistributionReferenceMonth(records)}-01`);
      const byMonth = new Map(records.map(r => [r.referenceDate.slice(0, 7), r]));
      const window = distributionWindowMonths(records);
      expect(window, t).toHaveLength(12);
      expect(window.at(-1), t).toBe(latestDistributionReferenceMonth(records));
      for (const m of window) expect(byMonth.get(m)?.distributionSource, `${t} ${m}`).toBe("fnet_structured");
      expect(ind.distributionCoverageMonths, t).toBe(12);
    }
  });

  it("IRDM11's historical cache cannot make it current-ready", () => {
    expect(readFiiCache("IRDM11")?.available).toBe(true); // the file stays as historical data
    expect(resolveModelRoute(asset("IRDM11"))).toBe("unavailable");
    expect(readiness("IRDM11")).toMatchObject({ readiness: "historical_or_unavailable", successorTicker: "IRIM11" });
  });
});

describe("readiness regression", () => {
  it("every historical code with a successor has that successor in the universe", () => {
    const missing = B3_UNIVERSE.map(a => assessAssetReadiness(a)).filter(r => r.readiness === "current_ticker_missing");
    expect(missing).toEqual([]);
  });

  it("no current asset is cache_pending", () => {
    const pending = B3_UNIVERSE.map(a => assessAssetReadiness(a)).filter(r => r.readiness === "cache_pending");
    expect(pending.map(r => r.ticker)).toEqual([]);
  });
});
