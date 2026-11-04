import { describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { WORKBOOK_FIXTURE, WORKBOOK_SOURCE, fixtureBytes, loadFixtureCvm, parsedWorkbookFixture } from "./__fixtures__/fixtures";
import { refreshMarketInfrastructureCache, type CvmOutcome, type SourceOutcome, type WorkbookInput } from "./market-infrastructure-refresh";
import { assessMarketInfrastructureCache } from "./market-infrastructure-readiness";
import { serializeMarketInfrastructureCache, validateMarketInfrastructureCache } from "./market-infrastructure-cache";
import { B3SA3_IDENTITY } from "./market-infrastructure-identity";
import { parseB3QuarterlyWorkbook } from "./b3-workbook";
import type { MarketInfrastructureCache, MarketInfrastructureStatement } from "./market-infrastructure-types";

const K = 1_000;
const T0 = "2026-11-04T00:00:00.000Z";

async function cvmOk(filter: (s: MarketInfrastructureStatement) => boolean = () => true): Promise<SourceOutcome<CvmOutcome>> {
  const d = await loadFixtureCvm();
  return { ok: true, value: { statements: d.statements.filter(filter), filings: d.filings.filter(f => d.statements.filter(filter).some(s => s.periodEnd === f.filingReferenceDate)), shareCounts: d.shareCounts, sources: d.sources } };
}
const wbOk = (parsed = parsedWorkbookFixture()): SourceOutcome<WorkbookInput> => ({ ok: true, value: { parsed, source: WORKBOOK_SOURCE } });
const failed = (error: string) => ({ ok: false as const, error });

async function refresh(over: Partial<Parameters<typeof refreshMarketInfrastructureCache>[0]> = {}) {
  return refreshMarketInfrastructureCache({
    identity: B3SA3_IDENTITY, legalName: null, previous: null,
    cvm: await cvmOk(), workbook: wbOk(), updatedAt: T0, ...over,
  });
}

async function fullCache(): Promise<MarketInfrastructureCache> {
  return (await refresh()).cache!;
}

describe("refresh — both sources ok", () => {
  it("writes a structurally valid analysis_ready candidate", async () => {
    const r = await refresh();
    expect(r).toMatchObject({ write: true, reason: "statements ok, segments ok, operating metrics ok" });
    const c = r.cache!;
    expect(validateMarketInfrastructureCache("B3SA3", c)).toEqual([]);
    expect(assessMarketInfrastructureCache("B3SA3", c)).toEqual({ candidate: "analysis_ready", reasons: [] });
    expect(c.referenceDates).toEqual({
      statementReferenceDate: "2026-06-30",
      filingDate: "2026-08-11",
      filingVersion: 1,
      segmentReferencePeriod: { periodStart: "2026-04-01", periodEnd: "2026-06-30", periodKind: "quarter" },
      workbookQuarter: "2T26",
      workbookPublicationDate: "2026-08-11",
      financialPositionReferenceDate: "2026-06-30",
      shareCountReferenceDate: "2026-06-30",
      capitalAllocationReferencePeriod: ["2026-06-30", "+2025-12-31", "-2025-06-30"],
    });
    expect(c.issuer).toMatchObject({ statementBasis: "consolidated", cvmCode: "21610" });
    expect(c.shareClass).toEqual({ ticker: "B3SA3", kind: "ON", isin: "BRB3SAACNOR6" });
    expect(c.warnings).toEqual([]);
  });

  it("deterministic except updatedAt", async () => {
    const a = (await refresh()).cache!;
    const b = (await refresh({ updatedAt: "2027-01-01T00:00:00.000Z" })).cache!;
    expect(serializeMarketInfrastructureCache({ ...b, updatedAt: T0 })).toBe(serializeMarketInfrastructureCache(a));
  });
});

describe("refresh — preservation semantics", () => {
  it("CVM advances while KPI enrichment is preserved (workbook failed)", async () => {
    const previous = await fullCache();
    const cvm = await cvmOk();
    if (!cvm.ok) throw new Error();
    const q3 = { ...structuredClone(cvm.value.statements.at(-1)!), periodEnd: "2026-09-30", quarter: 3 as const, filingDate: "2026-11-10" };
    cvm.value.statements.push(q3);
    const c = (await refresh({ previous, cvm, workbook: failed("HTTP 503") })).cache!;
    expect(c.latestStatement!.periodEnd).toBe("2026-09-30");
    expect(c.enrichment).toMatchObject({ statements: "ok", operatingMetrics: "preserved" });
    expect(c.operatingMetrics).toEqual(previous.operatingMetrics);
    expect(c.indicators.core.derivativesAdv.composition).toEqual(["2T26"]);
    const a = assessMarketInfrastructureCache("B3SA3", c);
    expect(a.candidate).toBe("analysis_limited");
    expect(a.reasons).toContain("workbook KPIs 2T26 ≠ statement quarter 2026-09-30");
  });

  it("a workbook never pairs with a statement of another quarter (CVM failed, history ends 1T26)", async () => {
    const previous = (await refresh({ cvm: await cvmOk(s => s.periodEnd <= "2026-03-31"), workbook: failed("not yet published") })).cache!;
    expect(previous.operatingMetrics).toBeNull();
    const r = await refresh({ previous, cvm: failed("CVM down"), workbook: wbOk() });
    expect(r.write).toBe(true);
    const c = r.cache!;
    expect(c.latestStatement!.periodEnd).toBe("2026-03-31");
    expect(c.enrichment).toMatchObject({ statements: "preserved", operatingMetrics: "failed" });
    expect(c.operatingMetrics).toBeNull();
    expect(c.enrichment.issues.some(i => /no consolidated statement for the workbook quarter 2T26/.test(i))).toBe(true);
  });

  it("both sources failing preserve the prior cache (nothing written)", async () => {
    const previous = await fullCache();
    expect(await refresh({ previous, cvm: failed("CVM down"), workbook: failed("RI down") })).toMatchObject({ cache: null, write: false });
  });

  it("no previous cache and CVM failing → nothing written", async () => {
    expect(await refresh({ cvm: failed("CVM down") })).toMatchObject({ cache: null, write: false });
  });

  it("an older workbook never replaces a newer validated snapshot", async () => {
    const previous = await fullCache();
    const older = { ...parsedWorkbookFixture(), quarterLabel: "1T26", quarterEnd: "2026-03-31" };
    older.incomeStatement = { ...older.incomeStatement, totalRevenue: 3_201_744 * K };
    const c = (await refresh({ previous, workbook: wbOk(older) })).cache!;
    expect(c.operatingMetrics!.quarterLabel).toBe("2T26");
    expect(c.enrichment.operatingMetrics).toBe("preserved");
  });

  it("an optional KPI that disappears becomes null — never zero", async () => {
    const files = unzipSync(fixtureBytes(WORKBOOK_FIXTURE));
    files["xl/sharedStrings.xml"] = strToU8(strFromU8(files["xl/sharedStrings.xml"]).split("<t>Tesouro Direto</t>").join("<t>Tesouro</t>"));
    const c = (await refresh({ workbook: wbOk(parseB3QuarterlyWorkbook(zipSync(files))) })).cache!;
    expect(c.indicators.secondary.tesouroDiretoAverageStock.value).toBeNull();
    expect(c.operatingMetrics!.secondary.tesouroDiretoAverageStock.value).toBeNull();
    expect(c.enrichment.operatingMetrics).toBe("ok");
  });

  it("a segment taxonomy change keeps statements valid and invalidates only the segment block", async () => {
    const cvm = await cvmOk();
    if (!cvm.ok) throw new Error();
    cvm.value.filings.find(f => f.filingReferenceDate === "2026-06-30")!.rows
      .filter(r => r.code === "3.01.02").forEach(r => { r.description = "Dados e Analytics"; });
    const c = (await refresh({ cvm })).cache!;
    expect(c.enrichment).toMatchObject({ statements: "ok", segments: "failed" });
    expect(c.indicators.core.revenueSegmentMix.value).toBeNull();
    expect(c.indicators.core.netRevenueTtm.value).toBe(10_777_143 * K);
    expect(c.warnings.some(w => /Segmentos de receita/.test(w))).toBe(true);
    expect(assessMarketInfrastructureCache("B3SA3", c).candidate).toBe("analysis_limited");
  });
});

describe("readiness diagnostic — cache_pending", () => {
  it("missing cache, wrong identity, non-consolidated basis", async () => {
    expect(assessMarketInfrastructureCache("B3SA3", null).candidate).toBe("cache_pending");
    expect(assessMarketInfrastructureCache("ITSA4", await fullCache()).candidate).toBe("cache_pending");
    const wrong = await fullCache();
    wrong.issuer = { ...wrong.issuer, cnpj: "00.000.000/0001-91" };
    expect(assessMarketInfrastructureCache("B3SA3", wrong).candidate).toBe("cache_pending");
    const parent = await fullCache();
    (parent.issuer as { statementBasis: string }).statementBasis = "individual";
    expect(assessMarketInfrastructureCache("B3SA3", parent).candidate).toBe("cache_pending");
  });

  it("managed financial position unavailable → analysis_limited", async () => {
    const c = await fullCache();
    c.financialPosition = { ...c.financialPosition!, managedNetFinancialPosition: null };
    expect(assessMarketInfrastructureCache("B3SA3", c)).toMatchObject({ candidate: "analysis_limited", reasons: ["managed net financial position unavailable"] });
  });
});
