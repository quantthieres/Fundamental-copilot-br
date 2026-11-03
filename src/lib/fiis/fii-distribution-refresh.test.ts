import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import type { FetchLike } from "./fii-fnet-client";
import {
  FNET_PRESERVED_WARNING,
  FNET_UNAVAILABLE_WARNING,
  noticeSinceDate,
  previousFnetMonths,
  refreshFiiDistributions,
} from "./fii-distribution-refresh";
import type { FiiFundIdentity } from "./fii-distributions";
import type { FiiAnalysisResponse, FiiFinancialRecord } from "./fii-types";

// Fake Fundos.Net only — never the live service.
const FIXTURES = join(__dirname, "__fixtures__/fnet");
const fixture = (name: string) => readFileSync(join(FIXTURES, name), "utf-8");
const listingRows = (JSON.parse(fixture("listing-rows.json")) as { data: Record<string, unknown>[] }).data;

const BTHF11: FiiFundIdentity = { ticker: "BTHF11", cnpj: "45.188.176/0001-57", isin: "BRBTHFCTF000" };
const MXRF11: FiiFundIdentity = { ticker: "MXRF11", cnpj: "97.521.225/0001-25", isin: "BRMXRFCTF008" };

const cvm = (ticker: string, months: string[]): FiiFinancialRecord[] => months.map(m => ({
  ticker, referenceDate: `${m}-01`, netAssetValue: 1, quotaCount: 1, netAssetValuePerShare: 9,
  cvmDerivedDistributionEstimate: 0.09, source: "fii_cvm_cache",
}));

function cacheWithFnet(ticker: string): FiiAnalysisResponse {
  return {
    ticker, source: "fii_analysis", sourceDetail: "fii_cvm_cache", available: true,
    records: [{ ...cvm(ticker, ["2025-12"])[0], monthlyDistributionPerShare: 0.10599, distributionSource: "fnet_structured", fnetDocumentIds: [1077704] }],
    indicators: null, updatedAt: "2026-11-01T00:00:00.000Z", warnings: [],
  };
}

// Routes by CNPJ in the search URL; documents by id.
function fakeFnet(byCnpj: Record<string, { rows: Record<string, unknown>[] } | number>, docs: Record<number, string | number>): FetchLike {
  return async (url: string) => {
    const cnpj = /cnpjFundo=(\d+)/.exec(url)?.[1];
    const id = /downloadDocumento\?id=(\d+)/.exec(url)?.[1];
    const body = cnpj ? byCnpj[cnpj] : id ? docs[Number(id)] : 404;
    if (body === undefined || typeof body === "number") return { ok: false, status: typeof body === "number" ? body : 404, text: async () => "" };
    const text = typeof body === "string" ? body : JSON.stringify({ data: body.rows, recordsTotal: body.rows.length });
    return { ok: true, status: 200, text: async () => text };
  };
}

const bthfRows = listingRows.filter(r => [1077704, 1077689, 874862].includes(r.id as number));
const mxrfRows = listingRows.filter(r => [709356, 709287].includes(r.id as number));
const docs = { 1077704: fixture("bthf11-1077704.xml"), 709356: fixture("mxrf11-709356.xml") };

describe("refreshFiiDistributions — per-ticker failure isolation", () => {
  it("writes Fundos.Net distributions when the source works", async () => {
    const out = await refreshFiiDistributions({
      identity: BTHF11, cvmRecords: cvm("BTHF11", ["2025-11", "2025-12"]), previous: null,
      fetchImpl: fakeFnet({ "45188176000157": { rows: bthfRows } }, docs), delayMs: 0,
    });
    expect(out.enrichment.status).toBe("ok");
    expect(out.records.map(r => [r.referenceDate, r.monthlyDistributionPerShare, r.distributionSource]))
      .toEqual([["2025-11-01", null, null], ["2025-12-01", 0.10599, "fnet_structured"]]);
  });

  it("outage: fresh CVM NAV advances while the previous Fundos.Net distributions are kept", async () => {
    // Committed: Dec-2025 from notice 1077704. Fresh informe: Dec-2025 (revised NAV) + Jan-2026.
    const fresh = cvm("BTHF11", ["2025-12", "2026-01"]).map(r => ({ ...r, netAssetValuePerShare: 9.5 }));
    const out = await refreshFiiDistributions({
      identity: BTHF11, cvmRecords: fresh, previous: cacheWithFnet("BTHF11"),
      fetchImpl: fakeFnet({ "45188176000157": 503 }, docs), delayMs: 0,
    });
    expect(out.enrichment).toMatchObject({ status: "preserved", issues: ["Fundos.Net unavailable (FNET search HTTP 503); prior authoritative distribution data preserved"] });
    expect(out.warnings).toEqual([FNET_PRESERVED_WARNING]);
    expect(out.records.map(r => [r.referenceDate, r.netAssetValuePerShare, r.monthlyDistributionPerShare])).toEqual([
      ["2025-12-01", 9.5, 0.10599],
      ["2026-01-01", 9.5, null],
    ]);
  });

  it("preserved distributions keep their provenance; no new month is synthesized", async () => {
    const prev = cacheWithFnet("BTHF11");
    prev.records = [
      ...prev.records.map(r => ({ ...r, distributionBaseDate: "2026-01-08", distributionPaymentDate: "2026-01-15" })),
      // An FNET-only month and an amortization month in the committed cache.
      { ticker: "BTHF11", referenceDate: "2026-01-01", netAssetValue: null, quotaCount: null, netAssetValuePerShare: null,
        monthlyDistributionPerShare: 0.101, distributionSource: "fnet_structured", fnetDocumentIds: [1104207],
        distributionBaseDate: "2026-02-06", distributionPaymentDate: "2026-02-13", monthlyAmortizationPerShare: 1.5, source: "fii_fnet_only" },
    ];
    const out = await refreshFiiDistributions({
      identity: BTHF11, cvmRecords: cvm("BTHF11", ["2025-11", "2025-12", "2026-01", "2026-02"]), previous: prev,
      fetchImpl: fakeFnet({ "45188176000157": { rows: bthfRows } }, { 1077704: 502 }), delayMs: 0,
    });
    expect(out.enrichment.status).toBe("preserved");
    const byMonth = new Map(out.records.map(r => [r.referenceDate.slice(0, 7), r]));
    expect(byMonth.get("2025-12")).toMatchObject({
      monthlyDistributionPerShare: 0.10599, distributionSource: "fnet_structured", fnetDocumentIds: [1077704],
      distributionBaseDate: "2026-01-08", distributionPaymentDate: "2026-01-15", cvmDerivedDistributionEstimate: 0.09,
    });
    expect(byMonth.get("2026-01")).toMatchObject({
      netAssetValuePerShare: 9, source: "fii_cvm_cache",           // informe now out: NAV filled
      monthlyDistributionPerShare: 0.101, fnetDocumentIds: [1104207], monthlyAmortizationPerShare: 1.5,
    });
    for (const m of ["2025-11", "2026-02"]) {
      expect(byMonth.get(m), m).toMatchObject({ monthlyDistributionPerShare: null, distributionSource: null, fnetDocumentIds: [] });
    }
  });

  it("an empty listing where the committed cache has Fundos.Net months counts as an outage", async () => {
    const out = await refreshFiiDistributions({
      identity: BTHF11, cvmRecords: cvm("BTHF11", ["2025-12"]), previous: cacheWithFnet("BTHF11"),
      fetchImpl: fakeFnet({ "45188176000157": { rows: [] } }, docs), delayMs: 0,
    });
    expect(out.enrichment.status).toBe("preserved");
    expect(out.records[0].monthlyDistributionPerShare).toBe(0.10599);
  });

  it("an outage for one fund does not degrade another fund", async () => {
    const fetchImpl = fakeFnet({ "45188176000157": 503, "97521225000125": { rows: mxrfRows } }, docs);
    const [bthf, mxrf] = await Promise.all([
      refreshFiiDistributions({ identity: BTHF11, cvmRecords: cvm("BTHF11", ["2025-12"]), previous: cacheWithFnet("BTHF11"), fetchImpl, delayMs: 0 }),
      refreshFiiDistributions({ identity: MXRF11, cvmRecords: cvm("MXRF11", ["2024-07"]), previous: cacheWithFnet("MXRF11"), fetchImpl, delayMs: 0 }),
    ]);
    expect(bthf.enrichment.status).toBe("preserved");
    expect(mxrf.enrichment.status).toBe("ok");
    expect(mxrf.records[0]).toMatchObject({ monthlyDistributionPerShare: 0.1, distributionSource: "fnet_structured" });
  });

  it("a brand-new fund with Fundos.Net down gets NAV only — no fabricated distributions", async () => {
    const out = await refreshFiiDistributions({
      identity: BTHF11, cvmRecords: cvm("BTHF11", ["2025-12"]), previous: null,
      fetchImpl: fakeFnet({ "45188176000157": 503 }, docs), delayMs: 0,
    });
    expect(out).toMatchObject({ enrichment: { status: "failed", issues: ["FNET search HTTP 503"] }, warnings: [FNET_UNAVAILABLE_WARNING] });
    expect(out.records[0]).toMatchObject({ netAssetValuePerShare: 9, monthlyDistributionPerShare: null, distributionSource: null, cvmDerivedDistributionEstimate: 0.09 });
  });

  it("a previous cache without Fundos.Net months has nothing to preserve", async () => {
    const old = { ...cacheWithFnet("BTHF11"), records: cvm("BTHF11", ["2025-12"]) };
    const out = await refreshFiiDistributions({
      identity: BTHF11, cvmRecords: cvm("BTHF11", ["2025-12"]), previous: old,
      fetchImpl: fakeFnet({ "45188176000157": 503 }, docs), delayMs: 0,
    });
    expect(out.enrichment.status).toBe("failed");
    expect(out.records[0].monthlyDistributionPerShare).toBeNull();
  });

  it("previousFnetMonths reads only Fundos.Net-backed or amortization months", () => {
    const prev = cacheWithFnet("BTHF11");
    prev.records.push({ ...cvm("BTHF11", ["2026-01"])[0], monthlyDistributionPerShare: null, distributionSource: null });
    expect([...previousFnetMonths(prev).keys()]).toEqual(["2025-12"]);
    expect(previousFnetMonths(null).size).toBe(0);
  });

  it("looks for notices from two months before the first record", () => {
    expect(noticeSinceDate("2025-01-01")).toBe("2024-11-01");
  });
});
