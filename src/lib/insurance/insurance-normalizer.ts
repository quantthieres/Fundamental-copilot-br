// Conservative normalizer for insurance company DFP CVM rows.
// Uses name-based matching (shortest code = parent account) because
// insurance DFP account positions vary by company (SUSEP/IFRS hybrid).
// Returns null for any field that cannot be reliably extracted. Does NOT invent zeros.

import type { RawCvmStatementRow } from "@/lib/cvm/types";
import type { InsuranceFinancialRecord } from "./insurance-types";

const BILLION = 1_000_000_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function norma(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

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

function extractTotalAssets(rows: RawCvmStatementRow[]): number | null {
  const byCode = sumByCode(rows, "1", "BPA");
  if (byCode !== null && byCode > 0) return byCode;

  for (const kws of [["total", "ativo"], ["ativo", "total"]]) {
    const v = findParentByName(rows, "BPA", kws, true);
    if (v !== null) return v;
  }
  return null;
}

function extractEquity(rows: RawCvmStatementRow[]): number | null {
  return findParentByName(rows, "BPP", ["patrimônio", "líquido"]);
}

function extractNetIncome(rows: RawCvmStatementRow[]): number | null {
  for (const code of ["3.11", "3.09"]) {
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

// Insurance premiums: earned premiums / premium revenue.
// Do NOT use 3.01 (industrial revenue). Use keyword matching only.
function extractInsurancePremiums(rows: RawCvmStatementRow[]): number | null {
  for (const kws of [
    ["prêmio", "ganho"],
    ["receita", "prêmio"],
    ["prêmio", "emitido"],
    ["prêmio", "seguro"],
  ]) {
    const v = findParentByName(rows, "DRE", kws, true);
    if (v !== null) return v;
  }
  return null;
}

// Claims expense: sinistros ocorridos / retidos.
function extractClaimsExpense(rows: RawCvmStatementRow[]): number | null {
  for (const kws of [
    ["sinistro", "ocorrido"],
    ["sinistro", "retido"],
    ["sinistro"],
  ]) {
    const v = findParentByName(rows, "DRE", kws);
    // Claims are typically negative in DFPs — return absolute value.
    if (v !== null && v !== 0) return Math.abs(v);
  }
  return null;
}

// Technical provisions: provisões técnicas (BPP liability).
function extractTechnicalProvisions(rows: RawCvmStatementRow[]): number | null {
  for (const kws of [
    ["provisão", "técnica"],
    ["provisões", "técnicas"],
  ]) {
    const v = findParentByName(rows, "BPP", kws, true);
    if (v !== null) return v;
  }
  return null;
}

// Financial result.
function extractFinancialResult(rows: RawCvmStatementRow[]): number | null {
  for (const kws of [
    ["resultado", "financeiro"],
    ["receita", "financeira"],
    ["resultado", "financeiro", "líquido"],
  ]) {
    const v = findParentByName(rows, "DRE", kws);
    if (v !== null) return v;
  }
  return null;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function normalizeInsuranceRows(
  ticker: string,
  fiscalYear: number,
  periodEndDate: string,
  rows: RawCvmStatementRow[],
): InsuranceFinancialRecord {
  const premiums   = extractInsurancePremiums(rows);
  const claims     = extractClaimsExpense(rows);
  const provisions = extractTechnicalProvisions(rows);
  const finResult  = extractFinancialResult(rows);

  return {
    ticker,
    fiscalYear,
    periodEndDate,
    totalAssets:          extractTotalAssets(rows),
    equity:               extractEquity(rows),
    netIncome:            extractNetIncome(rows),
    ...(premiums   !== null ? { insurancePremiums:    premiums   } : {}),
    ...(claims     !== null ? { claimsExpense:        claims     } : {}),
    ...(provisions !== null ? { technicalProvisions:  provisions } : {}),
    ...(finResult  !== null ? { financialResult:      finResult  } : {}),
    source: "cvm_dfp_insurance",
  };
}
