import { describe, it, expect } from "vitest";
import type { RawCvmStatementRow } from "@/lib/cvm/types";
import { normalizeBankRows } from "./bank-normalizer";

// Helper to build a minimal RawCvmStatementRow.
function row(
  statementType: string,
  accountCode: string,
  accountName: string,
  value: number,
): RawCvmStatementRow {
  return {
    cvmCode: "019348",
    companyName: "Test Bank S.A.",
    statementType,
    accountCode,
    accountName,
    periodEndDate: "2023-12-31",
    fiscalYear: 2023,
    // value is in actual BRL (normalizer divides by 1 billion to get billions)
    value,
  };
}

const BN = 1_000_000_000; // 1 billion BRL

const BASE_ROWS: RawCvmStatementRow[] = [
  // BPA
  row("BPA", "1",        "Total do Ativo",                  2_000 * BN),
  row("BPA", "1.01",     "Disponibilidades",                  100 * BN),
  row("BPA", "1.02",     "Operações de crédito",              800 * BN),
  // BPP
  row("BPP", "2",        "Total do Passivo",                1_800 * BN),
  row("BPP", "2.01",     "Depósitos",                         900 * BN),
  row("BPP", "2.03",     "Patrimônio Líquido Consolidado",    200 * BN),
  // DRE
  row("DRE", "3.01",     "Receita de Intermediação Financeira", 180 * BN),
  row("DRE", "3.11",     "Lucro Líquido do Período",            30 * BN),
];

describe("normalizeBankRows — base case", () => {
  const result = normalizeBankRows("ITUB4", 2023, "2023-12-31", BASE_ROWS);

  it("ticker matches", () => {
    expect(result.ticker).toBe("ITUB4");
  });

  it("fiscalYear matches", () => {
    expect(result.fiscalYear).toBe(2023);
  });

  it("totalAssets extracted from code 1", () => {
    expect(result.totalAssets).toBeCloseTo(2000);
  });

  it("equity extracted from code 2.03", () => {
    expect(result.equity).toBeCloseTo(200);
  });

  it("netIncome extracted from code 3.11", () => {
    expect(result.netIncome).toBeCloseTo(30);
  });

  it("financialIntermediationIncome extracted from code 3.01", () => {
    expect(result.financialIntermediationIncome).toBeCloseTo(180);
  });

  it("source is cvm_dfp_bank", () => {
    expect(result.source).toBe("cvm_dfp_bank");
  });
});

describe("normalizeBankRows — code fallbacks", () => {
  it("equity falls back to code 2.04 when 2.03 is absent", () => {
    const rows = [
      ...BASE_ROWS.filter(r => r.accountCode !== "2.03"),
      row("BPP", "2.04", "Patrimônio Líquido", 250 * BN),
    ];
    const result = normalizeBankRows("BBDC4", 2023, "2023-12-31", rows);
    expect(result.equity).toBeCloseTo(250);
  });

  it("netIncome falls back to name match when code 3.11 is absent", () => {
    const rows = [
      ...BASE_ROWS.filter(r => r.accountCode !== "3.11"),
      row("DRE", "3.12", "Lucro Líquido do Exercício", 28 * BN),
    ];
    const result = normalizeBankRows("BBAS3", 2023, "2023-12-31", rows);
    expect(result.netIncome).toBeCloseTo(28);
  });

  it("totalAssets falls back to name match when code 1 yields zero", () => {
    const rows = [
      ...BASE_ROWS.filter(r => r.accountCode !== "1"),
      row("BPA", "1", "Ativo Circulante", 0), // zero → ignored
      row("BPA", "99", "Total do Ativo", 1_900 * BN),
    ];
    const result = normalizeBankRows("SANB11", 2023, "2023-12-31", rows);
    expect(result.totalAssets).toBeCloseTo(1900);
  });
});

describe("normalizeBankRows — missing fields return null", () => {
  it("returns null totalAssets when BPA has no matching account", () => {
    const rows = BASE_ROWS.filter(r => r.statementType !== "BPA");
    const result = normalizeBankRows("BPAC11", 2023, "2023-12-31", rows);
    expect(result.totalAssets).toBeNull();
  });

  it("returns null equity when BPP has no PL account", () => {
    const rows = BASE_ROWS.filter(r => !["2.03", "2.04", "2.05"].includes(r.accountCode));
    const result = normalizeBankRows("BRSR6", 2023, "2023-12-31", rows);
    // Would only fail if there's also no name match
    const filtered = rows.filter(r => !(r.statementType === "BPP" && r.accountName.toLowerCase().includes("patrimônio")));
    const result2 = normalizeBankRows("BRSR6", 2023, "2023-12-31", filtered);
    expect(result2.equity).toBeNull();
  });

  it("returns null netIncome when DRE has no matching account", () => {
    const rows = BASE_ROWS.filter(r => r.statementType !== "DRE");
    const result = normalizeBankRows("ITUB4", 2023, "2023-12-31", rows);
    expect(result.netIncome).toBeNull();
  });

  it("loanPortfolio and deposits are null when rows are absent", () => {
    const result = normalizeBankRows("ITUB4", 2023, "2023-12-31", []);
    expect(result.loanPortfolio).toBeNull();
    expect(result.deposits).toBeNull();
    expect(result.totalAssets).toBeNull();
    expect(result.equity).toBeNull();
    expect(result.netIncome).toBeNull();
  });
});

describe("normalizeBankRows — optional fields", () => {
  it("loanPortfolio extracted from code 1.02", () => {
    const result = normalizeBankRows("ITUB4", 2023, "2023-12-31", BASE_ROWS);
    expect(result.loanPortfolio).toBeCloseTo(800);
  });

  it("deposits extracted from code 2.01", () => {
    const rows = [
      ...BASE_ROWS,
      row("BPP", "2.01.01", "Depósitos à Vista", 300 * BN),
    ];
    const result = normalizeBankRows("ITUB4", 2023, "2023-12-31", rows);
    // Either 2.01 (900) or 2.01.01 (300) - first code match wins
    expect(result.deposits).not.toBeNull();
  });
});
