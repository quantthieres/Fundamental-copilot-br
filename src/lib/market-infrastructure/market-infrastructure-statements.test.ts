import { describe, expect, it } from "vitest";
import { cvmFixtureFiles, fixtureText, loadFixtureCvm } from "./__fixtures__/fixtures";
import { parseConsolidatedStatementCsv, parseShareCountCsv, type CvmRow, type RawFiling } from "./market-infrastructure-cvm-rows";
import { buildStatement, computeTtm, ebitdaYtd, operatingResultYtd, quarterFromYtd, quarterGrossRevenue } from "./market-infrastructure-statements";
import { B3SA3_IDENTITY } from "./market-infrastructure-identity";
import type { MarketInfrastructureStatement } from "./market-infrastructure-types";

const K = 1_000;   // CVM files R$ thousands; the model stores BRL.

async function fixture() {
  return loadFixtureCvm();
}

function filingOf(filings: RawFiling[], ref: string): RawFiling {
  return structuredClone(filings.find(f => f.filingReferenceDate === ref)!);
}

const st = (statements: MarketInfrastructureStatement[], end: string) => statements.find(s => s.periodEnd === end)!;

describe("consolidated row reader", () => {
  it("keeps consolidated rows and rejects parent-only (DF Individual) rows", () => {
    const con = cvmFixtureFiles("ITR", 2026)["itr_cia_aberta_DRE_con_2026.csv"];
    const ind = fixtureText("cvm-b3-dre-ind-2026-06-30.csv").split("\n").slice(1).join("\n");
    const parsed = parseConsolidatedStatementCsv(`${con}${ind}`, "DRE", B3SA3_IDENTITY);
    expect(parsed.rejectedParentOnly).toBe(6);
    expect(parsed.rows.every(r => r.statement === "DRE")).toBe(true);
    const gross = parsed.rows.filter(r => r.code === "3.01" && r.order === "current" && r.periodStart === "2026-01-01" && r.periodEnd === "2026-06-30");
    expect(gross.map(r => r.value)).toEqual([6_283_136 * K]);   // parent-only 6,081,865 never read
  });

  it("rejects a file without the CVM layout or with an unknown scale", () => {
    expect(() => parseConsolidatedStatementCsv("A;B\n1;2\n", "DRE", B3SA3_IDENTITY)).toThrow(/missing column/);
    const con = cvmFixtureFiles("ITR", 2026)["itr_cia_aberta_DRE_con_2026.csv"].replace(/;MIL;/g, ";MILHAO;");
    expect(() => parseConsolidatedStatementCsv(con, "DRE", B3SA3_IDENTITY)).toThrow(/ESCALA_MOEDA/);
  });

  it("share counts are units (not thousands) and single-class", () => {
    const counts = parseShareCountCsv(cvmFixtureFiles("ITR", 2026)["itr_cia_aberta_composicao_capital_2026.csv"], B3SA3_IDENTITY.cnpj, "ITR");
    expect(counts.find(c => c.referenceDate === "2026-06-30")).toEqual({
      referenceDate: "2026-06-30", document: "ITR", filingVersion: 1,
      issuedShares: 5_046_500_000, treasuryShares: 48_201_452, outstandingShares: 4_998_298_548,
    });
    const withPn = cvmFixtureFiles("ITR", 2026)["itr_cia_aberta_composicao_capital_2026.csv"].replace(/;5046500000;0;/, ";5046500000;10;");
    expect(() => parseShareCountCsv(withPn, B3SA3_IDENTITY.cnpj, "ITR")).toThrow(/preferred/);
  });
});

describe("consolidated statements (2T26 ITR v1)", () => {
  it("selects consolidated statements with filing metadata", async () => {
    const { statements, rejectedParentOnlyRows } = await fixture();
    expect(rejectedParentOnlyRows).toBe(0);   // the _con files carry no parent-only rows
    expect(statements.every(s => s.basis === "consolidated")).toBe(true);
    expect(statements.map(s => s.periodEnd)).toEqual(["2024-06-30", "2024-12-31", "2025-03-31", "2025-06-30", "2025-09-30", "2025-12-31", "2026-03-31", "2026-06-30"]);
    expect(st(statements, "2026-06-30")).toMatchObject({
      document: "ITR", fiscalYear: 2026, quarter: 2, flowPeriodStart: "2026-01-01",
      filingDate: "2026-08-11", filingVersion: 1, cvmDocumentId: "160422",
    });
    expect(st(statements, "2025-12-31")).toMatchObject({ document: "DFP", quarter: 4, filingDate: "2026-02-26", cvmDocumentId: "154935" });
  });

  it("revenue, opex, EBIT, D&A, attributable net income, gross debt", async () => {
    const s = st((await fixture()).statements, "2026-06-30");
    expect(s).toMatchObject({
      grossRevenueYtd: 6_283_136 * K,
      revenueDeductionsYtd: -643_970 * K,
      netRevenueYtd: 5_639_166 * K,
      operatingExpensesYtd: -1_894_302 * K,
      otherOperatingIncomeYtd: 123_875 * K,
      ebitYtd: 3_866_854 * K,
      netIncomeAttributableYtd: 3_175_816 * K,
      depreciationAmortizationYtd: 190_955 * K,
      grossDebt: (2_623_296 + 12_310_020) * K,
      equity: 18_729_402 * K,
      nonControllingInterests: 24_439 * K,
      distributionsPaidYtd: -1_537_000 * K,
      buybacksYtd: -622_119 * K,
      capexPropertyYtd: -14_161 * K,
      capexSoftwareYtd: -92_789 * K,
    });
    expect(s.grossRevenueYtd! + s.revenueDeductionsYtd!).toBe(s.netRevenueYtd);
    expect(s.quarterFlows).toEqual({ periodStart: "2026-04-01", grossRevenue: 3_081_392 * K, netRevenue: 2_765_747 * K, operatingExpenses: -975_625 * K });
    expect(s.issues).toEqual([]);
  });

  it("revenue taxes filed inside 3.01 (ITR 2019–2022 layout) are added back to gross revenue", async () => {
    const filing = filingOf((await fixture()).filings, "2026-06-30");
    const ytd = (r: CvmRow) => r.statement === "DRE" && r.order === "current" && r.periodStart === "2026-01-01";
    const rows = filing.rows;
    const at = (code: string) => rows.find(r => ytd(r) && r.code === code)!;
    const pis = at("3.02.01").value;
    const iss = at("3.02.02").value;
    at("3.01").value = at("3.03").value;   // 3.01 filed net of taxes
    at("3.02").value = 0; at("3.02.01").value = 0; at("3.02.02").value = 0;
    rows.push({ ...at("3.01.05"), code: "3.01.06", description: "PIS e Cofins", value: pis });
    rows.push({ ...at("3.01.05"), code: "3.01.07", description: "Impostos sobre Serviços", value: iss });
    const s = buildStatement(filing, [])!;
    expect(s.grossRevenueYtd).toBe(6_283_136 * K);
    expect(s.revenueDeductionsYtd).toBe(-643_970 * K);
    expect(s.netRevenueYtd).toBe(5_639_166 * K);
    expect(s.issues.some(i => i.startsWith("note:") && i.includes("3.01.06, 3.01.07"))).toBe(true);
  });

  it("a non-tax line under 3.02 or a selling expense fails closed", async () => {
    const filing = filingOf((await fixture()).filings, "2026-06-30");
    const ytd = filing.rows.filter(r => r.statement === "DRE" && r.order === "current" && r.periodStart === "2026-01-01");
    ytd.find(r => r.code === "3.02.02")!.description = "Custo dos Serviços Prestados";
    ytd.find(r => r.code === "3.04.01")!.value = -1 * K;
    const s = buildStatement(filing, [])!;
    expect(s.grossRevenueYtd).toBeNull();
    expect(s.revenueDeductionsYtd).toBeNull();
    expect(s.netRevenueYtd).toBe(5_639_166 * K);
    expect(s.operatingExpensesYtd).toBeNull();
  });

  it("a relabelled fixed account fails closed", async () => {
    const filing = filingOf((await fixture()).filings, "2026-06-30");
    filing.rows.filter(r => r.code === "3.11.01").forEach(r => { r.description = "Atribuído a Não Controladores"; });
    expect(buildStatement(filing, [])!.netIncomeAttributableYtd).toBeNull();
  });
});

describe("EBITDA — B3 reported operating concept, not CVM 3.05 + D&A", () => {
  it("2T26 operating result + D&A = R$1,885.4mn (B3 published) within rounding; 3.05 + D&A does not reconcile", async () => {
    const { statements } = await fixture();
    const opResult = quarterFromYtd(statements, "2026-06-30", operatingResultYtd).value!;
    const da = quarterFromYtd(statements, "2026-06-30", "depreciationAmortizationYtd").value!;
    const ebitda = quarterFromYtd(statements, "2026-06-30", ebitdaYtd).value!;
    expect(opResult).toBe(1_790_122 * K);
    expect(ebitda).toBe(opResult + da);
    expect(Math.abs(ebitda - 1_885.4e6)).toBeLessThanOrEqual(0.05e6);
    const ebitPlusDa = quarterFromYtd(statements, "2026-06-30", s => (s.ebitYtd === null || s.depreciationAmortizationYtd === null ? null : s.ebitYtd + s.depreciationAmortizationYtd)).value!;
    expect(ebitPlusDa).toBe(2_010_127 * K);   // includes the Dimensa gain and equity-method income
    expect(st(statements, "2026-06-30").ebitYtd).toBe(3_866_854 * K);   // 3.05 stays stored
  });
});

describe("duplicate distribution lines are never summed", () => {
  it("two matching 'Pagamento de Proventos' rows under distinct codes → null", async () => {
    const filing = filingOf((await fixture()).filings, "2025-12-31");
    const row = filing.rows.find(r => r.statement.startsWith("DFC") && r.order === "current" && r.periodEnd === "2025-12-31" && r.description === "Pagamento de Proventos")!;
    filing.rows.push({ ...row, code: "6.03.09", value: -41_720 * K });
    const s = buildStatement(filing, [])!;
    expect(s.distributionsPaidYtd).toBeNull();
    expect(s.issues.some(i => /distributions paid: 2 lines under 6\.03\.\* match — ambiguous/.test(i))).toBe(true);
  });

  it("current TTM distributions are unaffected (single line in every input period)", async () => {
    const { statements } = await fixture();
    for (const end of ["2026-06-30", "2025-12-31", "2025-06-30"]) expect(st(statements, end).distributionsPaidYtd, end).not.toBeNull();
    expect(computeTtm(statements, "2026-06-30", "distributionsPaidYtd").value).toBe(-2_412_006 * K);
  });
});

describe("TTM and single-quarter values — non-overlapping cumulative periods", () => {
  it("net revenue, EBITDA, attributable net income, distributions, buybacks at 2T26", async () => {
    const { statements } = await fixture();
    const composition = ["2026-06-30", "+2025-12-31", "-2025-06-30"];
    expect(computeTtm(statements, "2026-06-30", "netRevenueYtd")).toEqual({ value: 10_777_143 * K, composition });
    expect(computeTtm(statements, "2026-06-30", ebitdaYtd)).toEqual({ value: 7_503_457 * K, composition });
    expect(computeTtm(statements, "2026-06-30", operatingResultYtd).value).toBe(7_119_850 * K);
    expect(computeTtm(statements, "2026-06-30", "netIncomeAttributableYtd")).toEqual({ value: 5_329_711 * K, composition });
    expect(computeTtm(statements, "2026-06-30", "distributionsPaidYtd").value).toBe(-2_412_006 * K);
    expect(computeTtm(statements, "2026-06-30", "buybacksYtd").value).toBe(-2_761_585 * K);
    expect(computeTtm(statements, "2025-12-31", "netRevenueYtd")).toEqual({ value: 10_068_227 * K, composition: ["2025-12-31"] });
  });

  it("never sums overlapping YTD observations", async () => {
    const { statements } = await fixture();
    const ttm = computeTtm(statements, "2026-06-30", "netRevenueYtd").value!;
    const naive = ["2026-03-31", "2026-06-30", "2025-09-30", "2025-12-31"].reduce((s, e) => s + st(statements, e).netRevenueYtd!, 0);
    expect(ttm).not.toBe(naive);
    expect(ttm).toBe(st(statements, "2026-06-30").netRevenueYtd! + st(statements, "2025-12-31").netRevenueYtd! - st(statements, "2025-06-30").netRevenueYtd!);
  });

  it("insufficient data → null, never zero", async () => {
    const { statements } = await fixture();
    const withoutFy = statements.filter(s => s.periodEnd !== "2025-12-31");
    expect(computeTtm(withoutFy, "2026-06-30", "netRevenueYtd")).toMatchObject({ value: null, reason: "no statement for 2025-12-31" });
    const nullField = statements.map(s => (s.periodEnd === "2025-06-30" ? { ...s, depreciationAmortizationYtd: null } : s));
    expect(computeTtm(nullField, "2026-06-30", ebitdaYtd).value).toBeNull();
    expect(computeTtm(statements, "2024-06-30", "netRevenueYtd").value).toBeNull();   // FY2023 / 1S23 absent
  });

  it("single-quarter values: own quarter rows, else YTD differences", async () => {
    const { statements } = await fixture();
    expect(quarterGrossRevenue(statements, "2026-06-30")).toEqual({ value: 3_081_392 * K, composition: ["2026-04-01..2026-06-30"] });
    expect(quarterFromYtd(statements, "2026-06-30", "depreciationAmortizationYtd")).toEqual({ value: 95_276 * K, composition: ["2026-06-30", "-2026-03-31"] });
    expect(quarterFromYtd(statements, "2026-06-30", ebitdaYtd).value).toBe(1_885_398 * K);   // B3 published 2T26 EBITDA
    // 4T25 = FY − 9M (DFP has no quarter rows).
    expect(quarterGrossRevenue(statements, "2025-12-31").composition).toEqual(["2025-12-31", "-2025-09-30"]);
  });
});
