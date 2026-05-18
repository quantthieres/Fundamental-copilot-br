// Conservative normalizer for bank DFP CVM rows.
// Uses name-based matching (shortest code = parent account) rather than
// hardcoded account codes, because bank DFP account positions vary by bank
// and year (IFRS/COSIF). Returns null for any field that cannot be reliably
// extracted. Does NOT invent zeros.

import type { RawCvmStatementRow } from "@/lib/cvm/types";
import type { BankFinancialRecord } from "./bank-types";

const BILLION = 1_000_000_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function norma(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Sum rows by exact account code in a given statement type.
function sumByCode(
  rows: RawCvmStatementRow[],
  code: string,
  statement: string,
): number | null {
  const matches = rows.filter(
    r => r.accountCode === code && r.statementType === statement,
  );
  if (matches.length === 0) return null;
  return matches.reduce((acc, r) => acc + r.value, 0) / BILLION;
}

// Finds rows in a given statement type where accountName contains ALL keywords.
// Returns all matches sorted by accountCode length ascending (shortest = parent).
function findByNameSorted(
  rows: RawCvmStatementRow[],
  statement: string,
  keywords: string[],
): RawCvmStatementRow[] {
  return rows
    .filter(r => {
      if (r.statementType !== statement) return false;
      const n = norma(r.accountName);
      return keywords.every(kw => n.includes(norma(kw)));
    })
    .sort((a, b) => a.accountCode.length - b.accountCode.length);
}

// Returns value of the shortest-code match (parent-level account) or null.
function findParentByName(
  rows: RawCvmStatementRow[],
  statement: string,
  keywords: string[],
  mustBePositive = false,
): number | null {
  const matches = findByNameSorted(rows, statement, keywords);
  for (const r of matches) {
    const v = r.value / BILLION;
    if (mustBePositive && v <= 0) continue;
    return v;
  }
  return null;
}

// ── Field extractors ──────────────────────────────────────────────────────────

// Total assets: code "1" in BPA (standard across bank DFPs).
// Falls back to name search for "total" + "ativo".
function extractTotalAssets(rows: RawCvmStatementRow[]): number | null {
  const byCode = sumByCode(rows, "1", "BPA");
  if (byCode !== null && byCode > 0) return byCode;

  for (const kws of [["total", "ativo"], ["ativo", "total"], ["total", "assets"]]) {
    const v = findParentByName(rows, "BPA", kws, true);
    if (v !== null) return v;
  }
  return null;
}

// Equity: bank DFPs place consolidated PL at codes 2.07 or 2.08 (varies by bank
// and year), NOT at 2.03/2.04/2.05 which are liability categories in COSIF.
// We look for the shortest-code BPP row whose name contains "patrimônio" and
// "líquido" — this is invariably the consolidated total.
function extractEquity(rows: RawCvmStatementRow[]): number | null {
  return findParentByName(rows, "BPP", ["patrimônio", "líquido"]);
}

// Net income: code 3.11 is standard in many bank DFPs; code 3.09 is used by
// Itaú Unibanco and others; 3.07 is a further fallback. Name search covers
// remaining cases.
function extractNetIncome(rows: RawCvmStatementRow[]): number | null {
  for (const code of ["3.11", "3.09", "3.07"]) {
    const v = sumByCode(rows, code, "DRE");
    if (v !== null) return v;
  }
  for (const kws of [
    ["lucro", "período"],
    ["lucro", "exercício"],
    ["resultado", "período"],
    ["lucro", "consolidado"],
  ]) {
    const v = findParentByName(rows, "DRE", kws);
    if (v !== null) return v;
  }
  return null;
}

// Loan portfolio: name-based only. Broad codes like 1.02 ("Ativos Financeiros")
// are far too large and must not be used.
function extractLoanPortfolio(rows: RawCvmStatementRow[]): number | null {
  for (const kws of [
    ["operações", "crédito"],
    ["carteira", "crédito"],
    ["empréstimos", "financiamentos"],
    ["crédito", "arrendamento"],
  ]) {
    const v = findParentByName(rows, "BPA", kws, true);
    if (v !== null) return v;
  }
  return null;
}

// Deposits: name "Depósitos" appears at different codes (2.02.01, 2.03.01, etc.)
// We match the shortest BPP row whose name starts with "depósito" and has a
// positive value (Banco Central deposits in BPA are excluded by statementType).
function extractDeposits(rows: RawCvmStatementRow[]): number | null {
  const candidates = findByNameSorted(rows, "BPP", ["depósito"])
    .filter(r => r.value > 0);
  if (candidates.length > 0) return candidates[0].value / BILLION;
  return null;
}

// Financial intermediation income: code 3.01 is standard.
function extractIntermediationIncome(rows: RawCvmStatementRow[]): number | null {
  const byCode = sumByCode(rows, "3.01", "DRE");
  if (byCode !== null) return byCode;

  for (const kws of [
    ["intermediação", "financeira"],
    ["receitas", "intermediação"],
    ["juros", "receita"],
  ]) {
    const v = findParentByName(rows, "DRE", kws);
    if (v !== null) return v;
  }
  return null;
}

// Provision expense: optional — negative in DFPs (credit loss provisions).
// A value of 0 is treated as absent (placeholder rows with zero values exist).
function extractProvisionExpense(rows: RawCvmStatementRow[]): number | null {
  for (const kws of [
    ["provisão", "perda"],
    ["provisão", "crédito"],
    ["perda", "esperada", "crédito"],
    ["pcld"],
  ]) {
    const v = findParentByName(rows, "DRE", kws);
    if (v !== null && v !== 0) return v;
  }
  return null;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function normalizeBankRows(
  ticker: string,
  fiscalYear: number,
  periodEndDate: string,
  rows: RawCvmStatementRow[],
): BankFinancialRecord {
  return {
    ticker,
    fiscalYear,
    periodEndDate,
    totalAssets:                   extractTotalAssets(rows),
    equity:                        extractEquity(rows),
    netIncome:                     extractNetIncome(rows),
    loanPortfolio:                 extractLoanPortfolio(rows),
    deposits:                      extractDeposits(rows),
    financialIntermediationIncome: extractIntermediationIncome(rows),
    provisionExpense:              extractProvisionExpense(rows),
    source: "cvm_dfp_bank",
  };
}
