import { describe, expect, it } from "vitest";
import { cvmFixtureFiles, fixtureText, fixtureZipLoader } from "./__fixtures__/fixtures";
import { loadHoldingCvmData } from "./holding-cvm-client";
import { groupRowsByPeriod, parseHoldingStatementCsv, type HoldingCvmRow } from "./holding-cvm-rows";
import { VERIFIED_HOLDING_IDENTITIES } from "./holding-identities";
import { buildHoldingStatement, computeTtm, readMappedFlow } from "./holding-statements";
import type { HoldingStatement } from "./holding-types";

// Official CVM rows (Dados Abertos ITR 2025/2026, DFP 2025) — no network.
const ITSA = VERIFIED_HOLDING_IDENTITIES.ITSA4;
const BRAP = VERIFIED_HOLDING_IDENTITIES.BRAP4;
const YEARS = { dfp: [2025], itr: [2025, 2026], optional: [] };
const M = 1_000_000;

async function statements(identity = ITSA) {
  return (await loadHoldingCvmData(identity, YEARS, fixtureZipLoader())).statements;
}
const at = (list: HoldingStatement[], end: string) => list.find(s => s.periodEnd === end)!;

describe("parent-only CVM rows", () => {
  const bpaInd = cvmFixtureFiles("ITR", 2026)["itr_cia_aberta_BPA_ind_2026.csv"];

  it("keeps only individual rows and rejects consolidated ones", () => {
    const con = fixtureText("cvm-itausa-bpa-con-2026-06-30.csv").split("\n").slice(1).join("\n");
    const { rows, rejectedConsolidated } = parseHoldingStatementCsv(`${bpaInd}${con}`, "BPA", ITSA);
    expect(rejectedConsolidated).toBe(2);
    const cash = rows.filter(r => r.code === "1.01.01" && r.periodEnd === "2026-06-30" && r.version === 2);
    expect(cash.map(r => r.value)).toEqual([2_191 * M]);  // consolidated cash is 4,709 mn
  });

  it("drops rows filed under another CNPJ", () => {
    const tampered = bpaInd.replace(/^61\.532\.644\/0001-15;/gm, "00.000.000/0001-91;");
    const res = parseHoldingStatementCsv(tampered, "BPA", ITSA);
    expect(res.rows).toHaveLength(0);
    expect(res.rejectedCnpj).toBeGreaterThan(0);
  });

  it("uses the highest filed version (Itaúsa 2T26 was re-filed as v2)", () => {
    const { rows } = parseHoldingStatementCsv(bpaInd, "BPA", ITSA);
    const june = groupRowsByPeriod(rows).find(p => p.periodEnd === "2026-06-30")!;
    expect(june.version).toBe(2);
    expect(june.rows.every(r => r.version === 2)).toBe(true);
  });

  it("keeps the cumulative YTD flow row, not the single-quarter row", () => {
    const dre = cvmFixtureFiles("ITR", 2026)["itr_cia_aberta_DRE_ind_2026.csv"];
    const { rows } = parseHoldingStatementCsv(dre, "DRE", BRAP);
    const june = groupRowsByPeriod(rows).find(p => p.periodEnd === "2026-06-30")!;
    expect(june.rows.filter(r => r.code === "3.04.06").map(r => r.value)).toEqual([804_987_000]);
  });

  it("throws on an unknown currency scale instead of guessing", () => {
    expect(() => parseHoldingStatementCsv(bpaInd.replace(/;MIL;/g, ";MILHAO;"), "BPA", ITSA)).toThrow(/ESCALA_MOEDA/);
  });
});

describe("Itaúsa parent-only statement at 2026-06-30", () => {
  it("reads the fixed accounts", async () => {
    const st = at(await statements(), "2026-06-30");
    expect(st).toMatchObject({
      document: "ITR", quarter: 2, basis: "individual", filingVersion: 2, filingDate: "2026-08-11", cvmDocumentId: "160385",
      cash: 2_191 * M,
      equityStakes: 94_579 * M,
      grossDebt: (351 + 3_024) * M,
      netDebt: (351 + 3_024 - 2_191) * M,   // NTS (1.01.02) not subtracted
      equity: 93_790 * M,
      generalAdministrativeExpensesYtd: -89 * M,
      equityMethodIncomeYtd: 10_129 * M,
      financialExpensesYtd: -680 * M,
      netIncomeYtd: 9_654 * M,
      issues: [],
    });
  });

  it("keeps the NTS stake in 1.01.02 out of cash", async () => {
    const st = at(await statements(), "2026-06-30");
    expect(st.shortTermInvestments).toMatchObject({
      value: 1_505 * M, classification: "portfolio_investment", includedInCash: false,
      account: { code: "1.01.02", description: "Aplicações Financeiras" },
    });
    expect(st.cash).toBe(2_191 * M);
  });

  it("maps dividends received (6.02.07) and interest paid (6.01.03.02)", async () => {
    const st = at(await statements(), "2026-06-30");
    expect(st.dividendsReceivedYtd).toBe(1_798 * M);
    expect(st.interestPaidYtd).toBe(-63 * M);
    expect(st.accounts).toContainEqual({ code: "6.02.07", description: "Juros sobre o capital próprio e Dividendos recebidos", value: 1_798 * M });
  });
});

describe("Bradespar parent-only statement at 2026-06-30", () => {
  it("has no borrowings and its cash is 1.01.01", async () => {
    const st = at(await statements(BRAP), "2026-06-30");
    expect(st).toMatchObject({
      cash: 254_451_000, grossDebt: 0, netDebt: -254_451_000, equity: 8_049_611_000, equityStakes: 7_745_764_000,
      generalAdministrativeExpensesYtd: -19_928_000, equityMethodIncomeYtd: 804_987_000,
      financialExpensesYtd: -280_000, netIncomeYtd: 805_819_000,
      dividendsReceivedYtd: 546_640_000, interestPaidYtd: null, issues: [],
    });
    expect(st.shortTermInvestments).toMatchObject({ value: 0, classification: "unverified", includedInCash: false });
  });

  it("accepts both verified spellings of 6.01.02.03", async () => {
    const list = await statements(BRAP);
    // ITR 2026Q1 omits "o" ("Juros sobre Capital Próprio…"); 2T26 includes it.
    expect(at(list, "2026-03-31").dividendsReceivedYtd).toBe(546_640_000);
    expect(at(list, "2025-12-31").dividendsReceivedYtd).toBe(685_334_000);
  });
});

describe("issuer-specific dividends mapping fails closed", () => {
  const row = (code: string, description: string, value = 1): HoldingCvmRow =>
    ({ statement: "DFC_MI", periodEnd: "2026-06-30", version: 1, periodStart: "2026-01-01", code, description, fixed: false, value });
  const mapping = ITSA.accounts.dividendsReceived;

  it("reads the verified line", () => {
    expect(readMappedFlow([row("6.02.07", "Juros sobre o capital próprio e Dividendos recebidos", 5)], mapping, "d")).toBe(5);
  });

  it("rejects the code when its description changes", () => {
    const issues: string[] = [];
    expect(readMappedFlow([row("6.02.07", "Aquisição de Investimentos")], mapping, "d", { accounts: [], issues })).toBeNull();
    expect(issues[0]).toMatch(/now "Aquisição de Investimentos"/);
  });

  it("rejects a different economic item even with similar words", () => {
    expect(readMappedFlow([row("6.02.07", "Juros sobre o capital próprio e Dividendos pagos")], mapping, "d")).toBeNull();
  });

  it("rejects when the verified description moves to another code", () => {
    const issues: string[] = [];
    const rows = [row("6.02.07", "Juros sobre o capital próprio e Dividendos recebidos"), row("6.02.08", "Juros sobre o capital próprio e dividendos recebidos")];
    expect(readMappedFlow(rows, mapping, "d", { accounts: [], issues })).toBeNull();
    expect(issues[0]).toMatch(/also at 6\.02\.08/);
  });

  it("rejects duplicate rows under the mapped code", () => {
    const rows = [row("6.02.07", "Juros sobre o capital próprio e Dividendos recebidos", 1), row("6.02.07", "Juros sobre o capital próprio e Dividendos recebidos", 2)];
    expect(readMappedFlow(rows, mapping, "d")).toBeNull();
  });

  it("a mismatched filing leaves the field null (never zero) and records the issue", () => {
    const files = cvmFixtureFiles("ITR", 2026);
    const dfc = files["itr_cia_aberta_DFC_MI_ind_2026.csv"].replace(/;6\.02\.07;Juros sobre o capital próprio e Dividendos recebidos;/g, ";6.02.07;Outros recebimentos;");
    const { rows } = parseHoldingStatementCsv(dfc, "DFC_MI", ITSA);
    const period = groupRowsByPeriod(rows).find(p => p.periodEnd === "2026-06-30")!;
    const st = buildHoldingStatement(period, "ITR", ITSA, [])!;
    expect(st.dividendsReceivedYtd).toBeNull();
    expect(st.issues.some(i => /dividends received: 6\.02\.07 is now "Outros recebimentos"/.test(i))).toBe(true);
  });
});

describe("computeTtm — cumulative interim statements", () => {
  const st = (periodEnd: string, dividendsReceivedYtd: number | null, quarter: 1 | 2 | 3 | 4): HoldingStatement => ({
    periodEnd, document: quarter === 4 ? "DFP" : "ITR", fiscalYear: Number(periodEnd.slice(0, 4)), quarter,
    flowPeriodStart: `${periodEnd.slice(0, 4)}-01-01`, filingDate: null, filingVersion: 1, cvmDocumentId: null, basis: "individual",
    cash: null, shortTermInvestments: null, equityStakes: null, grossDebt: null, netDebt: null, equity: null,
    generalAdministrativeExpensesYtd: null, equityMethodIncomeYtd: null, financialExpensesYtd: null, netIncomeYtd: null,
    dividendsReceivedYtd, interestPaidYtd: null, accounts: [], issues: [],
  });

  it("Q2: current H1 + previous FY − previous H1", () => {
    const list = [st("2025-06-30", 7_955, 2), st("2025-12-31", 18_655, 4), st("2026-06-30", 1_798, 2)];
    expect(computeTtm(list, "2026-06-30", "dividendsReceivedYtd")).toEqual({
      value: 12_498, composition: ["2026-06-30", "+2025-12-31", "-2025-06-30"],
    });
  });

  it("Q4: the fiscal year itself (no overlapping sum)", () => {
    const list = [st("2025-06-30", 7_955, 2), st("2025-12-31", 18_655, 4)];
    expect(computeTtm(list, "2025-12-31", "dividendsReceivedYtd").value).toBe(18_655);
  });

  it("null (not zero) when a required period is missing", () => {
    const list = [st("2025-12-31", 18_655, 4), st("2026-06-30", 1_798, 2)];
    expect(computeTtm(list, "2026-06-30", "dividendsReceivedYtd")).toMatchObject({ value: null, reason: "no statement for 2025-06-30" });
  });

  it("null when an input value failed its mapping", () => {
    const list = [st("2025-06-30", null, 2), st("2025-12-31", 18_655, 4), st("2026-06-30", 1_798, 2)];
    expect(computeTtm(list, "2026-06-30", "dividendsReceivedYtd").value).toBeNull();
  });

  it("null when flows are not cumulative from Jan 1", () => {
    const odd = { ...st("2025-06-30", 7_955, 2), flowPeriodStart: "2025-04-01" };
    const list = [odd, st("2025-12-31", 18_655, 4), st("2026-06-30", 1_798, 2)];
    expect(computeTtm(list, "2026-06-30", "dividendsReceivedYtd").value).toBeNull();
  });

  it("matches the official filings for both issuers", async () => {
    expect(computeTtm(await statements(), "2026-06-30", "dividendsReceivedYtd").value).toBe(12_498 * M);
    expect(computeTtm(await statements(BRAP), "2026-06-30", "dividendsReceivedYtd").value).toBe(546_640_000 + 685_334_000 - 422_157_000);
  });
});

describe("loadHoldingCvmData", () => {
  it("fails when a required year cannot be downloaded", async () => {
    await expect(loadHoldingCvmData(ITSA, { dfp: [2024], itr: [], optional: [] }, fixtureZipLoader()))
      .rejects.toThrow("CVM DFP 2024 zip unavailable");
  });

  it("skips an optional (current) year that does not exist yet", async () => {
    const res = await loadHoldingCvmData(ITSA, { dfp: [2025, 2026], itr: [], optional: [2026] }, fixtureZipLoader());
    expect(res.statements.map(s => s.periodEnd)).toEqual(["2025-12-31"]);
  });
});
