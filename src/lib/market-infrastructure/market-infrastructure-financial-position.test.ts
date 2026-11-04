import { describe, expect, it } from "vitest";
import { loadFixtureCvm } from "./__fixtures__/fixtures";
import type { CvmRow, RawFiling } from "./market-infrastructure-cvm-rows";
import { buildStatement } from "./market-infrastructure-statements";
import { buildFinancialPosition } from "./market-infrastructure-financial-position";

const K = 1_000;

async function filing(ref: string): Promise<RawFiling> {
  const { filings } = await loadFixtureCvm();
  return structuredClone(filings.find(f => f.filingReferenceDate === ref)!);
}

function position(f: RawFiling) {
  return buildFinancialPosition(buildStatement(f, [])!);
}

const balance = (f: RawFiling, code: string) =>
  f.rows.filter(r => r.code === code && r.order === "current" && r.periodStart === "");

describe("managed net financial position — B3 capital-management concept", () => {
  it("reproduces +R$1,560,977 thousand at 2026-06-30", async () => {
    const fp = position(await filing("2026-06-30"));
    expect(fp.managedNetFinancialPosition).toBe(1_560_977 * K);
    expect(fp).toMatchObject({
      referenceDate: "2026-06-30",
      balanceSheetCashReported: 1_163_233 * K,
      financialInvestments: (15_339_419 + 356_766 + 2_299_626 + 181_705) * K,
      grossDebt: 14_933_316 * K,
      derivativeLiabilities: 8_020 * K,
      thirdPartyBalances: { referenceDate: "2026-06-30", collateralReceived: 2_654_736 * K, custodyPayments: 183_700 * K, otherValidatedThirdPartyBalances: [] },
    });
    expect(fp.issues).toEqual([]);
  });

  it("reproduces −R$243,139 thousand at 2025-12-31 (non-current derivative line absent, proven zero)", async () => {
    const fp = position(await filing("2025-12-31"));
    expect(fp.managedNetFinancialPosition).toBe(-243_139 * K);
    expect(fp.derivativeLiabilities).toBe(6_562 * K);
  });

  it("includes the non-current derivative line when filed (2025-09-30)", async () => {
    const f = await filing("2025-09-30");
    expect(balance(f, "2.02.02.02.04")).toHaveLength(1);
    expect(position(f).managedNetFinancialPosition).toBe(337_735 * K);
  });

  it("subtracts third-party liabilities explicitly", async () => {
    const fp = position(await filing("2026-06-30"));
    const byAccount = Object.fromEntries(fp.components.map(c => [c.accounts.join("+"), c]));
    expect(byAccount["2.01.05.02.04"]).toMatchObject({ sign: -1, value: 2_654_736 * K });
    expect(byAccount["2.01.05.02.05"]).toMatchObject({ sign: -1, value: 183_700 * K });
    expect(fp.components.reduce((s, c) => s + c.sign * c.value!, 0)).toBe(fp.managedNetFinancialPosition);
    expect(fp.caveats.join(" ")).toMatch(/não é caixa livre/);
    expect(fp.caveats.join(" ")).toMatch(/Banco B3/);
  });
});

describe("third-party lines fail closed", () => {
  it("changed description → managed position null", async () => {
    const f = await filing("2026-06-30");
    balance(f, "2.01.05.02.04").forEach(r => { r.description = "Garantias Recebidas em Operações e Outras"; });
    const fp = position(f);
    expect(fp.thirdPartyBalances.collateralReceived).toBeNull();
    expect(fp.managedNetFinancialPosition).toBeNull();
    expect(fp.issues[0]).toMatch(/2\.01\.05\.02\.04 not validated/);
  });

  it("missing critical line → managed position null (never zero)", async () => {
    const f = await filing("2026-06-30");
    f.rows = f.rows.filter(r => r.code !== "2.01.05.02.05");
    const fp = position(f);
    expect(fp.thirdPartyBalances.custodyPayments).toBeNull();
    expect(fp.managedNetFinancialPosition).toBeNull();
  });

  it("duplicate rows with conflicting values → ambiguous → null", async () => {
    const f = await filing("2026-06-30");
    const row = balance(f, "2.01.05.02.04")[0];
    f.rows.push({ ...row, value: row.value + 1 });
    expect(position(f).managedNetFinancialPosition).toBeNull();
  });

  it("verified description appearing under another code (line moved) → null", async () => {
    const f = await filing("2026-06-30");
    const row = balance(f, "2.01.05.02.05")[0];
    f.rows.push({ ...row, code: "2.01.05.02.10" } as CvmRow);
    const st = buildStatement(f, [])!;
    expect(st.custodyPayments).toBeNull();
    expect(st.issues.some(i => /also at 2\.01\.05\.02\.10/.test(i))).toBe(true);
  });

  it("absent non-current derivative line is zero only when its parent sum proves it", async () => {
    const f = await filing("2025-09-30");
    // A consistent filing with a non-zero line (2021–2023 had one), then the line disappears:
    // the parent 2.02.02.02 no longer equals Σ filed children, so absence is not provably zero.
    balance(f, "2.02.02.02.04")[0].value = 43_675 * K;
    balance(f, "2.02.02.02")[0].value += 43_675 * K;
    expect(position(f).derivativeLiabilities).toBe((7_225 + 43_675) * K);
    f.rows = f.rows.filter(r => r.code !== "2.02.02.02.04");
    const fp = position(f);
    expect(fp.derivativeLiabilities).toBeNull();
    expect(fp.managedNetFinancialPosition).toBeNull();
  });
});

describe("1.01.01 is not B3 cash; cash-flow cash is secondary provenance", () => {
  it("cash per cash-flow statement is 6.05.02, not 1.01.01; own-cash reading validated only for 2T26", async () => {
    const fp = position(await filing("2026-06-30"));
    expect(fp.balanceSheetCashReported).toBe(1_163_233 * K);
    expect(fp.cashAndCashEquivalentsPerCashFlow).toBe(355_309 * K);
    expect(fp.balanceSheetCashNotInCashFlowCash).toBe(807_924 * K);
    expect(fp.ownCashInterpretationValidatedFor).toEqual(["2026-06-30"]);
    expect(Object.keys(fp).filter(k => /^ownCash(AndEquivalents)?$/.test(k))).toEqual([]);
  });

  it("the own-cash reading is not generalised to other periods", async () => {
    const fp = position(await filing("2025-12-31"));
    expect(fp.cashAndCashEquivalentsPerCashFlow).toBe(351_405 * K);
    expect(fp.ownCashInterpretationValidatedFor).toEqual([]);
  });

  it("cash-flow cash never enters the managed position or leverage", async () => {
    const f = await filing("2026-06-30");
    const before = position(f);
    f.rows.filter(r => ["6.05.01", "6.05.02"].includes(r.code) && r.order === "current").forEach(r => { r.value -= 100_000 * K; });
    const after = position(f);
    expect(after.cashAndCashEquivalentsPerCashFlow).toBe(255_309 * K);
    expect(after.managedNetFinancialPosition).toBe(before.managedNetFinancialPosition);
    expect(after.components.flatMap(c => c.accounts)).not.toContain("6.05.02");
  });

  it("cash-flow cash is null when the cash-flow statement does not reconcile — no residual guess", async () => {
    const f = await filing("2026-06-30");
    f.rows.filter(r => r.code === "6.05.01" && r.order === "current").forEach(r => { r.value += K; });
    const fp = position(f);
    expect(fp.cashAndCashEquivalentsPerCashFlow).toBeNull();
    expect(fp.balanceSheetCashNotInCashFlowCash).toBeNull();
    expect(fp.managedNetFinancialPosition).toBe(1_560_977 * K);   // unaffected
  });

  it("exposes no cash − debt net debt", async () => {
    const fp = position(await filing("2026-06-30"));
    expect(Object.keys(fp).filter(k => /net.?debt|netCash|liquid/i.test(k))).toEqual([]);
  });
});
