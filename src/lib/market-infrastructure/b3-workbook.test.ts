import { describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { WORKBOOK_FIXTURE, WORKBOOK_SOURCE, fixtureBytes, fixtureText, loadFixtureCvm, parsedWorkbookFixture } from "./__fixtures__/fixtures";
import { WorkbookLayoutError, parseB3QuarterlyWorkbook } from "./b3-workbook";
import { XlsxFormatError } from "./xlsx-reader";
import { fetchB3Workbook, selectWorkbookMeta, type MzDocumentMeta } from "./b3-workbook-source";
import {
  REVENUE_CROSS_CHECK_RELATIVE_TOLERANCE,
  SNG_PASS_THROUGH_START_PERIOD,
  isSngPassThroughPeriod,
  quarterPeriodKey,
  revenueCrossCheckTolerance,
  validateOperatingMetrics,
} from "./market-infrastructure-kpis";

const K = 1_000;

/** Rewrites one part of the fixture XLSX (real zip round-trip). */
function editWorkbook(part: string, edit: (xml: string) => string): Uint8Array {
  const files = unzipSync(fixtureBytes(WORKBOOK_FIXTURE));
  files[part] = strToU8(edit(strFromU8(files[part])));
  return zipSync(files);
}
const editSharedString = (from: string, to: string) =>
  editWorkbook("xl/sharedStrings.xml", xml => {
    expect(xml.includes(`<t>${from}</t>`)).toBe(true);
    return xml.split(`<t>${from}</t>`).join(`<t>${to}</t>`);
  });

describe("official quarterly workbook — XLSX parsing path", () => {
  it("identifies the latest quarter from the PT/EN header pair", () => {
    const wb = parsedWorkbookFixture();
    expect([wb.quarterLabel, wb.quarterEnd]).toEqual(["2T26", "2026-06-30"]);
  });

  it("reads the CORE KPIs in B3's units", () => {
    const wb = parsedWorkbookFixture();
    expect(wb.derivatives.adv.value).toBeCloseTo(11_097.901426, 5);
    expect(wb.derivatives.adv.unit).toBe("milhares de contratos/dia (média do trimestre)");
    expect(wb.derivatives.rpc.value).toBeCloseTo(1.180121, 5);
    expect(wb.cashEquities.adtv.value).toBeCloseTo(31_309.775533, 5);
    expect(wb.cashEquities.adtv.unit).toBe("R$ milhões/dia (média do trimestre)");
    expect(wb.cashEquities.feeMarginBps.value).toBeCloseTo(3.074342, 5);
    expect(wb.fixedIncomeCredit.bankingInstrumentsAverageStock.value).toBeCloseTo(5_431.097122, 5);
    expect(wb.fixedIncomeCredit.corporateBondsAverageStock.value).toBeCloseTo(1_466.457907, 5);
    expect(wb.fixedIncomeCredit.otherAverageStock.value).toBeCloseTo(2_789.562737, 5);
    expect(wb.derivatives.adv.source).toBe("Derivatives › Derivativos - Volumes & RPC › Geral › ADV total (milhares de contratos) › 2T26");
  });

  it("reads the income-statement anchors and the secondary KPIs", () => {
    const wb = parsedWorkbookFixture();
    expect(wb.incomeStatement).toMatchObject({
      totalRevenue: 3_081_392 * K,
      expenses: -975_625 * K,
      operatingResult: 1_790_122 * K,
      ebitda: 1_885_398 * K,
    });
    expect(wb.incomeStatement.operatingMargin).toBeCloseTo(0.647247, 6);
    expect(wb.incomeStatement.expenseLines!.map(l => l.label)).toEqual([
      "Pessoal e encargos", "Tecnologia da informação", "Depreciação e amortização", "Atrelada ao faturamento",
      "Serviços de terceiros", "Manutenção em geral", "Comunicações", "Promoção e divulgação", "Impostos e taxas",
      "Honorários do conselho/comitês", "Relacionadas à combinação com a Cetip", "Diversas",
    ]);
    expect(wb.incomeStatement.expenseLines!.reduce((s, l) => s + l.value, 0)).toBe(-975_625 * K);
    expect(wb.secondary.otcDerivativesAverageStock.value).toBeCloseTo(8_856.027257, 5);
    expect(wb.secondary.securitiesLendingAverageOpenInterest.value).toBeCloseTo(218.692564, 5);
    expect(wb.secondary.tesouroDiretoAverageStock.value).toBeCloseTo(236.198881, 5);
    expect(wb.notes.some(n => /amarelo/.test(n))).toBe(true);
    expect(wb.notes.some(n => /hedge/.test(n))).toBe(true);
    expect(wb.issues).toEqual([]);
  });
});

describe("malformed workbooks are rejected", () => {
  it("not an XLSX", () => {
    expect(() => parseB3QuarterlyWorkbook(new Uint8Array([1, 2, 3, 4]))).toThrow(XlsxFormatError);
  });

  it("missing sheet", () => {
    const bytes = editWorkbook("xl/workbook.xml", xml => xml.replace(/<sheet name="Derivatives"[^>]*\/>/, ""));
    expect(() => parseB3QuarterlyWorkbook(bytes)).toThrow(/sheet "Derivatives" missing/);
  });

  it("relabelled CORE row", () => {
    expect(() => parseB3QuarterlyWorkbook(editSharedString("Geral", "Total geral"))).toThrow(WorkbookLayoutError);
  });

  it("PT and EN quarter headers disagree", () => {
    expect(() => parseB3QuarterlyWorkbook(editSharedString("2Q26", "3Q26"))).toThrow(/no matching EN header/);
  });

  it("blocks disagreeing on the latest quarter", () => {
    const bytes = editWorkbook("xl/worksheets/sheet10.xml", xml => xml.replace(/<c r="AT(5|6)"[^>]*>[\s\S]*?<\/c>/g, ""));
    expect(() => parseB3QuarterlyWorkbook(bytes)).toThrow(/disagree on the latest quarter/);
  });

  it("a missing OPTIONAL KPI becomes null with an issue — never zero", () => {
    const wb = parseB3QuarterlyWorkbook(editSharedString("Tesouro Direto", "Tesouro"));
    expect(wb.secondary.tesouroDiretoAverageStock.value).toBeNull();
    expect(wb.issues.some(i => /Tesouro Direto.*optional value unavailable/.test(i))).toBe(true);
    expect(wb.derivatives.adv.value).not.toBeNull();
  });
});

describe("workbook ↔ CVM same-quarter cross-check", () => {
  it("2T26 total revenue equals CVM 3.01 of the quarter; official figures reconcile", async () => {
    const { statements } = await loadFixtureCvm();
    const v = validateOperatingMetrics(parsedWorkbookFixture(), WORKBOOK_SOURCE, statements);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(v.snapshot.revenueCrossCheck).toMatchObject({ workbookTotalRevenue: 3_081_392 * K, cvmGrossRevenueQuarter: 3_081_392 * K, difference: 0, passed: true });
    expect(v.snapshot.officialReconciliation.map(r => [r.label, r.passed, r.difference])).toEqual([
      ["Resultado operacional (trimestre)", true, 0],
      ["Margem operacional (trimestre)", true, 0],
      ["EBITDA (trimestre)", true, 0],
    ]);
    expect(v.snapshot.expenseComposition?.reconciled).toBe(true);
    expect(v.snapshot.notes.some(n => /SNG/.test(n))).toBe(true);
  });

  it("a workbook whose quarter has no CVM statement is rejected (never paired with another quarter)", async () => {
    const { statements } = await loadFixtureCvm();
    const v = validateOperatingMetrics(parsedWorkbookFixture(), WORKBOOK_SOURCE, statements.filter(s => s.periodEnd !== "2026-06-30"));
    expect(v).toMatchObject({ ok: false, reason: expect.stringMatching(/no consolidated statement for the workbook quarter 2T26/) });
  });

  it("0.01% tolerance boundary: inside passes, outside fails", async () => {
    const { statements } = await loadFixtureCvm();
    expect(REVENUE_CROSS_CHECK_RELATIVE_TOLERANCE).toBe(0.0001);
    const tol = revenueCrossCheckTolerance(3_081_392 * K);
    expect(tol).toBeCloseTo(308_139.2, 6);
    const shifted = (delta: number) => {
      const wb = parsedWorkbookFixture();
      wb.incomeStatement = { ...wb.incomeStatement, totalRevenue: wb.incomeStatement.totalRevenue + delta };
      return validateOperatingMetrics(wb, WORKBOOK_SOURCE, statements);
    };
    expect(shifted(308_139).ok).toBe(true);
    expect(shifted(-308_139).ok).toBe(true);
    expect(shifted(308_140)).toMatchObject({ ok: false, reason: expect.stringMatching(/difference 308140/) });
    expect(shifted(-308_140).ok).toBe(false);
  });

  it("SNG pass-through note from one named start period (2026-Q1)", () => {
    expect(SNG_PASS_THROUGH_START_PERIOD).toBe("2026-Q1");
    expect(quarterPeriodKey("2026-03-31")).toBe("2026-Q1");
    expect(isSngPassThroughPeriod("2025-12-31")).toBe(false);
    expect(isSngPassThroughPeriod("2026-03-31")).toBe(true);
    expect(isSngPassThroughPeriod("2027-09-30")).toBe(true);
  });

  it("a revenue mismatch rejects the snapshot", async () => {
    const { statements } = await loadFixtureCvm();
    const altered = statements.map(s => (s.periodEnd === "2026-06-30" ? { ...s, quarterFlows: { ...s.quarterFlows!, grossRevenue: s.quarterFlows!.grossRevenue! + 10_000_000 } } : s));
    expect(validateOperatingMetrics(parsedWorkbookFixture(), WORKBOOK_SOURCE, altered)).toMatchObject({ ok: false, reason: expect.stringMatching(/≠ CVM 3\.01/) });
  });
});

describe("B3 RI listing discovery (recorded response, no network)", () => {
  const listing = (JSON.parse(fixtureText("b3-ri-listing-2026.json")) as { response: { data: { document_metas: MzDocumentMeta[] } } }).response;
  const metas = listing.data.document_metas;

  it("selects the newest published 'Dados Trimestrais - Nova Segmentação'", () => {
    expect(selectWorkbookMeta(metas)).toMatchObject({ id: "0e3b9b70-2505-4fa8-99d7-052c32ab8729", file_quarter: 2, file_year: 2026 });
    expect(selectWorkbookMeta(metas.map(m => ({ ...m, file_title: "Release de Resultados" })))).toBeNull();
    expect(selectWorkbookMeta(metas.map(m => ({ ...m, company_id: "other" })))).toBeNull();
  });

  it("fetchB3Workbook with an injected fetcher: listing + XLSX → parsed, quarter checked against the listing", async () => {
    const xlsx = fixtureBytes(WORKBOOK_FIXTURE);
    const fetcher = (body: unknown) => async (url: string) =>
      url.includes("apicatalog") ? new Response(JSON.stringify(body)) : new Response(xlsx);
    const ok = await fetchB3Workbook(new Date("2026-11-04T00:00:00Z"), fetcher(listing));
    expect(ok.ok && ok.value.parsed.quarterLabel).toBe("2T26");
    expect(ok.ok && ok.value.source).toMatchObject({ mzDocumentId: "0e3b9b70-2505-4fa8-99d7-052c32ab8729", publishedDate: "2026-08-11", byteLength: xlsx.length });

    const wrongQuarter = { ...listing, data: { document_metas: metas.map(m => ({ ...m, file_quarter: 3 })) } };
    expect(await fetchB3Workbook(new Date("2026-11-04T00:00:00Z"), fetcher(wrongQuarter))).toMatchObject({ ok: false, error: expect.stringMatching(/2T26 ≠ listing quarter 3T26/) });
  });
});
