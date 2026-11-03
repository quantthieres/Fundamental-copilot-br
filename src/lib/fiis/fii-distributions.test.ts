import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import type { FetchedFnetNotice } from "./fii-fnet-client";
import { parseNoticeXml, type FnetNotice, type FnetNoticeListing } from "./fii-fnet-parser";
import {
  aggregateByMonth,
  compareDistributionSources,
  enrichWithFnet,
  fnetEnrichmentFailed,
  fnetTechnicalFailure,
  matchEventIdentity,
  mergeDistributions,
  parseCompetenceMonth,
  selectFundEvents,
  type FiiFundIdentity,
} from "./fii-distributions";
import type { FiiFinancialRecord } from "./fii-types";

const FIXTURES = join(__dirname, "__fixtures__/fnet");

function notice(name: string): FnetNotice {
  const parsed = parseNoticeXml(readFileSync(join(FIXTURES, name), "utf-8"));
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.notice;
}

function fetched(
  id: number,
  file: string | null,
  status: FnetNoticeListing["status"] = "active",
  version = 1,
  deliveredAt = "2026-01-01T00:00",
): FetchedFnetNotice {
  return { listing: { id, status, version, deliveredAt }, notice: file ? notice(file) : null };
}

const BTHF11: FiiFundIdentity = { ticker: "BTHF11", cnpj: "45.188.176/0001-57", isin: "BRBTHFCTF000" };
const MXRF11: FiiFundIdentity = { ticker: "MXRF11", cnpj: "97.521.225/0001-25", isin: "BRMXRFCTF008" };
const IRIM11: FiiFundIdentity = { ticker: "IRIM11", cnpj: "41.076.564/0001-95", isin: "BRIRIMCTF003" };
const IRDM11: FiiFundIdentity = { ticker: "IRDM11", cnpj: "28.830.325/0001-10", isin: "BRIRDMCTF004" };

function record(referenceDate: string, cvm: number | null, ticker = "BTHF11"): FiiFinancialRecord {
  return {
    ticker,
    referenceDate,
    netAssetValue: 1,
    quotaCount: 1,
    netAssetValuePerShare: 9,
    cvmDerivedDistributionEstimate: cvm,
    source: "fii_cvm_cache",
  };
}

// ── Identity ──────────────────────────────────────────────────────────────────

describe("matchEventIdentity", () => {
  it("requires CNPJ, ISIN and ticker to agree", () => {
    const ev = { isin: "BRBTHFCTF000", ticker: "BTHF11" };
    expect(matchEventIdentity(BTHF11, "45188176000157", ev)).toBe("match");
    expect(matchEventIdentity(BTHF11, "11026627000138", ev)).toBe("cnpj_mismatch");
    expect(matchEventIdentity(BTHF11, "45188176000157", { ...ev, isin: "BR0EI9CTF007" })).toBe("isin_mismatch");
    expect(matchEventIdentity(BTHF11, "45188176000157", { ...ev, ticker: "BTHF12" })).toBe("ticker_mismatch");
  });

  it("treats other quotas of the same fund (receipts) as out of scope, not errors", () => {
    expect(matchEventIdentity(MXRF11, "97521225000125", { isin: "BRMXRFR24M16", ticker: "MXRF13" })).toBe("other_quota");
  });

  it("falls back to CNPJ + ticker when the ISIN is unknown", () => {
    expect(matchEventIdentity({ ...BTHF11, isin: null }, "45188176000157", { isin: "BRANYCTF000", ticker: "BTHF11" })).toBe("match");
  });

  it("keeps IRDM11 and IRIM11 apart: an IRIM11 notice never matches IRDM11", () => {
    const ev = notice("irim11-1344822.xml");
    expect(matchEventIdentity(IRDM11, ev.cnpj, ev.events[0])).toBe("cnpj_mismatch");
    expect(selectFundEvents(IRDM11, [fetched(1344822, "irim11-1344822.xml")]).events).toEqual([]);
  });
});

// ── Month assignment ──────────────────────────────────────────────────────────

describe("parseCompetenceMonth", () => {
  it("reads every observed format", () => {
    expect(parseCompetenceMonth("Setembro-2026", "2026-10-09")).toEqual({ month: "2026-09" });
    expect(parseCompetenceMonth("OUTUBRO 2025", "2025-10-31")).toEqual({ month: "2025-10" });
    expect(parseCompetenceMonth("Março-2025", "2025-04-07")).toEqual({ month: "2025-03" });
    expect(parseCompetenceMonth("05/2025", "2025-06-17")).toEqual({ month: "2025-05" });
    expect(parseCompetenceMonth("OUTUBRO ", "2025-10-31")).toEqual({ month: "2025-10" });
  });

  it("dates a bare month by the latest such month on or before the data base", () => {
    expect(parseCompetenceMonth("DEZEMBRO", "2025-12-30")).toEqual({ month: "2025-12" });
    expect(parseCompetenceMonth("Dezembro", "2026-01-08")).toEqual({ month: "2025-12" });
  });

  it("refuses to guess", () => {
    expect(parseCompetenceMonth("1º semestre", "2026-01-08")).toHaveProperty("error");
    expect(parseCompetenceMonth("Outubro", null)).toHaveProperty("error");
    expect(parseCompetenceMonth("Novembro-2026", "2026-10-30")).toHaveProperty("error");
  });
});

// ── Event selection ───────────────────────────────────────────────────────────

describe("selectFundEvents", () => {
  it("assigns by reference month, not data base or payment month (IRIM11 Sep paid in Oct)", () => {
    const { events } = selectFundEvents(IRIM11, [fetched(1344822, "irim11-1344822.xml")]);
    expect(events).toEqual([{
      kind: "rendimento", month: "2026-09", valuePerShare: 0.75,
      baseDate: "2026-10-09", paymentDate: "2026-10-19", documentId: 1344822,
    }]);
  });

  it("uses only the traded quota from a multi-ISIN notice", () => {
    const { events, issues } = selectFundEvents(
      { ticker: "KNCR11", cnpj: "16706958000132", isin: "BRKNCRCTF000" },
      [fetched(1025876, "kncr11-1025876.xml")],
    );
    expect(events.map(e => [e.month, e.valuePerShare])).toEqual([["2025-10", 1.33]]);
    expect(issues).toEqual([]);
  });

  it("a reapresentação replaces the superseded version, whatever the input order", () => {
    const v1 = fetched(1077689, "bthf11-1077689.xml", "superseded", 1, "2026-01-08T18:27");
    const v2 = fetched(1077704, "bthf11-1077704.xml", "active", 2, "2026-01-08T18:39");
    for (const order of [[v1, v2], [v2, v1]]) {
      expect(selectFundEvents(BTHF11, order).events.map(e => [e.month, e.valuePerShare, e.documentId]))
        .toEqual([["2025-12", 0.10599, 1077704]]);
    }
  });

  it("cancelled notices never contribute (MXRF11 Jul-2024 refiled)", () => {
    const cancelled = fetched(709287, "mxrf11-709287.xml", "cancelled", 1, "2024-07-31T17:30");
    const refiled = fetched(709356, "mxrf11-709356.xml", "active", 1, "2024-07-31T17:50");
    const { events } = selectFundEvents(MXRF11, [cancelled, refiled]);
    expect(events.map(e => [e.month, e.valuePerShare, e.documentId])).toEqual([["2024-07", 0.1, 709356]]);
  });

  it("a cancelled notice with the wrong ISIN is ignored (BTHF11 874862)", () => {
    expect(selectFundEvents(BTHF11, [fetched(874862, "bthf11-874862.xml", "cancelled")]).events).toEqual([]);
  });

  it("the alternative CVM ISIN BR0EI9CTF007 never matches BTHF11, even if that notice were active", () => {
    const n = notice("bthf11-874862.xml");
    expect(n.cnpj).toBe("45188176000157");
    expect(n.events[0]).toMatchObject({ isin: "BR0EI9CTF007", ticker: "4770023FII" });
    expect(selectFundEvents(BTHF11, [fetched(874862, "bthf11-874862.xml", "active")]).events).toEqual([]);
    // A configured identity using that ISIN rejects the active BTHF11 notices instead.
    expect(selectFundEvents({ ...BTHF11, isin: "BR0EI9CTF007" }, [fetched(1077704, "bthf11-1077704.xml")]).events).toEqual([]);
  });

  it("an active notice with a mismatched ISIN is rejected and reported", () => {
    const { events, issues } = selectFundEvents({ ...BTHF11, isin: "BR0EI9CTF007" }, [fetched(1077704, "bthf11-1077704.xml")]);
    expect(events).toEqual([]);
    expect(issues).toEqual(["notice 1077704: isin_mismatch (BTHF11 BRBTHFCTF000), ignored"]);
  });

  it("two active notices for the same event are not double counted", () => {
    const a = fetched(709287, "mxrf11-709287.xml", "active", 1, "2024-07-31T17:30");
    const b = fetched(709356, "mxrf11-709356.xml", "active", 1, "2024-07-31T17:50");
    const { events, issues } = selectFundEvents(MXRF11, [a, b]);
    expect(events.map(e => e.documentId)).toEqual([709356]);
    expect(issues).toEqual(["duplicate active notices for rendimento 2024-07 (data base 2024-07-31): kept 709356, dropped 709287"]);
  });

  it("reports unreadable active notices", () => {
    const broken: FetchedFnetNotice = { listing: { id: 1, status: "active", version: 1, deliveredAt: "2026-01-01T00:00" }, notice: null, error: "HTTP 503" };
    expect(selectFundEvents(BTHF11, [broken]).issues).toEqual(["notice 1: HTTP 503"]);
  });
});

// ── Aggregation ───────────────────────────────────────────────────────────────

describe("aggregateByMonth", () => {
  const base = { baseDate: "2026-10-30", paymentDate: "2026-11-16" };

  it("keeps amortização apart from the distribution", () => {
    const vids: FiiFundIdentity = { ticker: "VIDS11", cnpj: "", isin: "BRVIDSCTF003" };
    const n = notice("vids11-1365813.xml");
    vids.cnpj = n.cnpj;
    const m = aggregateByMonth(selectFundEvents(vids, [fetched(1365813, "vids11-1365813.xml")]).events).get("2026-10");
    expect(m).toMatchObject({ distributionPerShare: 27.6954846041, amortizationPerShare: 109.7208763993, documentIds: [1365813] });
  });

  it("an amortização-only month has no distribution", () => {
    const n = notice("reme11-1364168.xml");
    const m = aggregateByMonth(selectFundEvents({ ticker: "REME11", cnpj: n.cnpj, isin: "BRREMECTF001" }, [fetched(1364168, "reme11-1364168.xml")]).events);
    expect(m.get("2026-10")).toMatchObject({ distributionPerShare: null, amortizationPerShare: 10 });
  });

  it("sums separate rendimento events of one month without float noise", () => {
    const m = aggregateByMonth([
      { kind: "rendimento", month: "2026-10", valuePerShare: 0.1, documentId: 2, ...base },
      { kind: "rendimento", month: "2026-10", valuePerShare: 0.2, documentId: 1, ...base, baseDate: "2026-10-15" },
    ]).get("2026-10");
    expect(m).toMatchObject({ distributionPerShare: 0.3, documentIds: [1, 2], baseDate: "2026-10-30" });
  });
});

// ── Merge and precedence ──────────────────────────────────────────────────────

describe("mergeDistributions", () => {
  const fnet = new Map([
    ["2025-12", { month: "2025-12", distributionPerShare: 0.10599, amortizationPerShare: null, baseDate: "2026-01-08", paymentDate: "2026-01-15", documentIds: [1077704] }],
    ["2026-01", { month: "2026-01", distributionPerShare: 0, amortizationPerShare: null, baseDate: "2026-02-06", paymentDate: "2026-02-13", documentIds: [9] }],
  ]);

  it("the distribution is the Fundos.Net amount; the CVM estimate is a separate diagnostic", () => {
    const [r] = mergeDistributions([record("2025-12-01", 0.1177)], fnet);
    expect(r).toMatchObject({
      monthlyDistributionPerShare: 0.10599,
      distributionSource: "fnet_structured",
      cvmDerivedDistributionEstimate: 0.1177,
      distributionBaseDate: "2026-01-08",
      distributionPaymentDate: "2026-01-15",
      fnetDocumentIds: [1077704],
    });
  });

  it("the CVM estimate never becomes the distribution: no notice → null", () => {
    const out = mergeDistributions([record("2025-11-01", 0.0921), record("2025-10-01", null)], fnet);
    const withEstimate = out.find(r => r.referenceDate === "2025-11-01");
    const none = out.find(r => r.referenceDate === "2025-10-01");
    expect(withEstimate).toMatchObject({ monthlyDistributionPerShare: null, distributionSource: null, cvmDerivedDistributionEstimate: 0.0921, fnetDocumentIds: [] });
    expect(none).toMatchObject({ monthlyDistributionPerShare: null, distributionSource: null, cvmDerivedDistributionEstimate: null });
  });

  it("an explicit Fundos.Net zero is data, distinct from missing", () => {
    const [r] = mergeDistributions([record("2026-01-01", null)], fnet);
    expect(r).toMatchObject({ monthlyDistributionPerShare: 0, distributionSource: "fnet_structured" });
  });

  it("adds a Fundos.Net-only month newer than the informe, with NAV left null", () => {
    const out = mergeDistributions([record("2025-11-01", null)], fnet);
    expect(out.map(r => [r.referenceDate, r.source, r.netAssetValuePerShare, r.monthlyDistributionPerShare])).toEqual([
      ["2025-11-01", "fii_cvm_cache", 9, null],
      ["2025-12-01", "fii_fnet_only", null, 0.10599],
      ["2026-01-01", "fii_fnet_only", null, 0],
    ]);
    expect(out[1]).toMatchObject({ netAssetValue: null, quotaCount: null, cvmDerivedDistributionEstimate: null });
  });

  it("never adds Fundos.Net months before the first informe month", () => {
    expect(mergeDistributions([record("2026-01-01", null)], fnet).map(r => r.referenceDate)).toEqual(["2026-01-01"]);
  });

  it("is idempotent: re-merging a merged cache keeps the CVM records and drops stale FNET-only rows", () => {
    const once = mergeDistributions([record("2025-11-01", 0.09)], fnet);
    expect(mergeDistributions(once, fnet)).toEqual(once);
    expect(mergeDistributions(once, new Map()).map(r => r.referenceDate)).toEqual(["2025-11-01"]);
  });
});

describe("enrichment result", () => {
  const records = [record("2025-11-01", 0.09), record("2025-12-01", null)];

  it("is deterministic regardless of notice order", () => {
    const a = fetched(1077689, "bthf11-1077689.xml", "superseded", 1, "2026-01-08T18:27");
    const b = fetched(1077704, "bthf11-1077704.xml", "active", 2, "2026-01-08T18:39");
    expect(JSON.stringify(enrichWithFnet(BTHF11, records, [a, b])))
      .toBe(JSON.stringify(enrichWithFnet(BTHF11, records, [b, a])));
    expect(enrichWithFnet(BTHF11, records, [a, b]).enrichment).toEqual({
      source: "fnet_structured", status: "ok", isin: "BRBTHFCTF000", noticesListed: 2, noticesUsed: 1, issues: [],
    });
  });

  it("failure without an earlier cache: NAV kept, every distribution null — no estimate", () => {
    const { records: out, enrichment } = fnetEnrichmentFailed(BTHF11, records, "FNET search HTTP 503");
    expect(out.map(r => [r.netAssetValuePerShare, r.monthlyDistributionPerShare, r.distributionSource, r.cvmDerivedDistributionEstimate]))
      .toEqual([[9, null, null, 0.09], [9, null, null, null]]);
    expect(enrichment).toMatchObject({ status: "failed", issues: ["FNET search HTTP 503"] });
  });

  it("no notices at all is reported as no_events", () => {
    expect(enrichWithFnet(BTHF11, records, []).enrichment.status).toBe("no_events");
  });

  it("an unreadable active notice is a technical failure; superseded/cancelled ones are not", () => {
    const broken: FetchedFnetNotice = { listing: { id: 7, status: "active", version: 1, deliveredAt: "2026-01-01T00:00" }, notice: null, error: "HTTP 503" };
    expect(fnetTechnicalFailure([broken])).toBe("notice 7: HTTP 503");
    expect(fnetTechnicalFailure([fetched(1077689, null, "superseded"), fetched(874862, null, "cancelled")])).toBeNull();
  });
});

describe("compareDistributionSources", () => {
  it("classifies with explicit tolerances", () => {
    expect(compareDistributionSources(1.1, 1.1007721)).toBe("match");
    expect(compareDistributionSources(0.1, 0.1013)).toBe("rounding");
    expect(compareDistributionSources(1.1, 0.9783)).toBe("material");
    expect(compareDistributionSources(0, 0)).toBe("match");
    expect(compareDistributionSources(0, 0.01)).toBe("material");
  });
});
