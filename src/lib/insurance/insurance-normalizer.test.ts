import { describe, it, expect } from "vitest";
import { normalizeInsuranceRows } from "./insurance-normalizer";
import type { RawCvmStatementRow } from "@/lib/cvm/types";

const BILLION = 1_000_000_000;

function row(
  statementType: string,
  accountCode: string,
  accountName: string,
  value: number,
): RawCvmStatementRow {
  return {
    cvmCode:       "9999",
    companyName:   "Test Seguradora S.A.",
    statementType,
    accountCode,
    accountName,
    periodEndDate: "2024-12-31",
    fiscalYear:    2024,
    value: value * BILLION,
  };
}

const FULL_ROWS: RawCvmStatementRow[] = [
  row("BPA", "1",   "Ativo Total", 200),
  row("BPP", "2.06","Patrimônio Líquido", 40),
  row("DRE", "3.11","Lucro Líquido do Período", 8),
  row("DRE", "3.02","Prêmios Ganhos", 60),
  row("DRE", "3.04","Sinistros Ocorridos", -42),
  row("BPP", "2.03","Provisões Técnicas", 80),
  row("DRE", "3.07","Resultado Financeiro", 5),
];

describe("normalizeInsuranceRows", () => {
  it("extracts all fields from a complete DFP", () => {
    const result = normalizeInsuranceRows("TEST3", 2024, "2024-12-31", FULL_ROWS);
    expect(result.ticker).toBe("TEST3");
    expect(result.fiscalYear).toBe(2024);
    expect(result.totalAssets).toBeCloseTo(200);
    expect(result.equity).toBeCloseTo(40);
    expect(result.netIncome).toBeCloseTo(8);
    expect(result.insurancePremiums).toBeCloseTo(60);
    expect(result.claimsExpense).toBeCloseTo(42); // abs value
    expect(result.technicalProvisions).toBeCloseTo(80);
    expect(result.financialResult).toBeCloseTo(5);
    expect(result.source).toBe("cvm_dfp_insurance");
  });

  it("returns null for totalAssets when absent", () => {
    const rows = FULL_ROWS.filter(r => !(r.statementType === "BPA" && r.accountCode === "1"));
    const result = normalizeInsuranceRows("TEST3", 2024, "2024-12-31", rows);
    expect(result.totalAssets).toBeNull();
  });

  it("returns null for equity when absent", () => {
    const rows = FULL_ROWS.filter(r => !r.accountName.includes("Patrimônio Líquido"));
    const result = normalizeInsuranceRows("TEST3", 2024, "2024-12-31", rows);
    expect(result.equity).toBeNull();
  });

  it("returns null for netIncome when absent", () => {
    const rows = FULL_ROWS.filter(r => r.accountCode !== "3.11");
    const result = normalizeInsuranceRows("TEST3", 2024, "2024-12-31", rows);
    expect(result.netIncome).toBeNull();
  });

  it("omits insurancePremiums when absent (optional field)", () => {
    const rows = FULL_ROWS.filter(r => !r.accountName.includes("Prêmios Ganhos"));
    const result = normalizeInsuranceRows("TEST3", 2024, "2024-12-31", rows);
    expect(result.insurancePremiums).toBeUndefined();
  });

  it("omits claimsExpense when absent", () => {
    const rows = FULL_ROWS.filter(r => !r.accountName.includes("Sinistros"));
    const result = normalizeInsuranceRows("TEST3", 2024, "2024-12-31", rows);
    expect(result.claimsExpense).toBeUndefined();
  });

  it("returns all-null required fields and no optional fields when no rows", () => {
    const result = normalizeInsuranceRows("TEST3", 2024, "2024-12-31", []);
    expect(result.totalAssets).toBeNull();
    expect(result.equity).toBeNull();
    expect(result.netIncome).toBeNull();
    expect(result.insurancePremiums).toBeUndefined();
    expect(result.claimsExpense).toBeUndefined();
  });

  it("takes the absolute value of negative claims expense", () => {
    const rows = [row("DRE", "3.04", "Sinistros Ocorridos", -30)];
    const result = normalizeInsuranceRows("TEST3", 2024, "2024-12-31", rows);
    expect(result.claimsExpense).toBeCloseTo(30);
  });

  it("matches prêmios by keyword fallback", () => {
    const rows = [row("DRE", "3.02", "Receita de Prêmio de Seguro", 55)];
    const result = normalizeInsuranceRows("TEST3", 2024, "2024-12-31", rows);
    expect(result.insurancePremiums).toBeCloseTo(55);
  });
});
