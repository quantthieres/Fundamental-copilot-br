// Holding statements from parent-only CVM filings.
//
// Fixed CVM accounts (ST_CONTA_FIXA = S) are read by code and checked against
// their standard description. Company-defined cash-flow lines (dividends
// received, interest paid) use the issuer mapping in holding-identities.ts and
// fail closed — the field stays null, with an issue — when the description at
// the code changes, the description moves to another code, or the code is
// ambiguous. Nothing is guessed and no missing value becomes zero.
//
// No @/ imports — also used by tsx scripts.

import type { HoldingCvmRow, HoldingRawPeriod, CvmFilingIndexEntry } from "./holding-cvm-rows";
import type { HoldingStatement, StatementAccountRef } from "./holding-types";
import { descriptionMatches, normalizeAccountDescription, type HoldingIdentity, type IssuerAccountMapping } from "./holding-identities";

/** Standard descriptions of the fixed accounts the holding model reads. */
export const FIXED_ACCOUNTS = {
  cash:                          { statement: "BPA", code: "1.01.01", description: "Caixa e Equivalentes de Caixa" },
  shortTermInvestments:          { statement: "BPA", code: "1.01.02", description: "Aplicações Financeiras" },
  equityStakes:                  { statement: "BPA", code: "1.02.02", description: "Investimentos" },
  currentDebt:                   { statement: "BPP", code: "2.01.04", description: "Empréstimos e Financiamentos" },
  nonCurrentDebt:                { statement: "BPP", code: "2.02.01", description: "Empréstimos e Financiamentos" },
  equity:                        { statement: "BPP", code: "2.03",    description: "Patrimônio Líquido" },
  generalAdministrativeExpenses: { statement: "DRE", code: "3.04.02", description: "Despesas Gerais e Administrativas" },
  equityMethodIncome:            { statement: "DRE", code: "3.04.06", description: "Resultado de Equivalência Patrimonial" },
  financialExpenses:             { statement: "DRE", code: "3.06.02", description: "Despesas Financeiras" },
  netIncome:                     { statement: "DRE", code: "3.11",    description: "Lucro/Prejuízo do Período" },
} as const;

type FixedKey = keyof typeof FIXED_ACCOUNTS;

interface Reader {
  rows: readonly HoldingCvmRow[];
  accounts: StatementAccountRef[];
  issues: string[];
}

function rowsFor(r: Reader, statementPrefix: string, code: string): HoldingCvmRow[] {
  return r.rows.filter(x => x.code === code && x.statement.startsWith(statementPrefix));
}

function record(r: Reader, row: HoldingCvmRow): number {
  r.accounts.push({ code: row.code, description: row.description, value: row.value });
  return row.value;
}

function readFixed(r: Reader, key: FixedKey): number | null {
  const spec = FIXED_ACCOUNTS[key];
  const found = rowsFor(r, spec.statement, spec.code);
  if (found.length === 0) {
    r.issues.push(`${spec.code} ${spec.description}: not filed`);
    return null;
  }
  if (new Set(found.map(f => f.value)).size > 1) {
    r.issues.push(`${spec.code}: ${found.length} conflicting rows`);
    return null;
  }
  const row = found[0];
  if (!row.fixed || normalizeAccountDescription(row.description) !== normalizeAccountDescription(spec.description)) {
    r.issues.push(`${spec.code}: expected fixed account "${spec.description}", found "${row.description}"`);
    return null;
  }
  return record(r, row);
}

/**
 * Reads an issuer-defined cash-flow line. Fails closed (null + issue) when:
 *   - the code is missing or carries conflicting rows;
 *   - the code's description is not one of the verified descriptions;
 *   - a verified description appears under another code (the line moved).
 */
export function readMappedFlow(
  rows: readonly HoldingCvmRow[],
  mapping: IssuerAccountMapping,
  label: string,
  sink?: { accounts: StatementAccountRef[]; issues: string[] },
): number | null {
  const r: Reader = { rows, accounts: sink?.accounts ?? [], issues: sink?.issues ?? [] };
  const cashFlow = rows.filter(x => x.statement.startsWith("DFC"));
  const atCode = cashFlow.filter(x => x.code === mapping.code);
  const elsewhere = cashFlow.filter(x => x.code !== mapping.code && descriptionMatches(mapping, x.description));

  if (elsewhere.length > 0) {
    r.issues.push(`${label}: verified description now also at ${[...new Set(elsewhere.map(e => e.code))].join(", ")} — mapping must be re-verified`);
    return null;
  }
  if (atCode.length === 0) {
    r.issues.push(`${label}: ${mapping.code} not filed`);
    return null;
  }
  if (atCode.length > 1) {
    r.issues.push(`${label}: ${atCode.length} rows under ${mapping.code} — ambiguous`);
    return null;
  }
  const row = atCode[0];
  if (!descriptionMatches(mapping, row.description)) {
    r.issues.push(`${label}: ${mapping.code} is now "${row.description}" — mapping must be re-verified`);
    return null;
  }
  return record(r, row);
}

function quarterOf(periodEnd: string): 1 | 2 | 3 | 4 | null {
  switch (periodEnd.slice(5)) {
    case "03-31": return 1;
    case "06-30": return 2;
    case "09-30": return 3;
    case "12-31": return 4;
    default: return null;
  }
}

/**
 * Builds one parent-only statement. Returns null for a non-calendar period
 * end (outside the Jan–Dec fiscal year the model supports).
 */
export function buildHoldingStatement(
  period: HoldingRawPeriod,
  document: "DFP" | "ITR",
  identity: HoldingIdentity,
  filings: readonly CvmFilingIndexEntry[],
): HoldingStatement | null {
  const quarter = quarterOf(period.periodEnd);
  if (quarter === null) return null;
  if ((document === "DFP") !== (quarter === 4)) return null;

  const r: Reader = { rows: period.rows, accounts: [], issues: [] };
  const filing = filings.find(f => f.document === document && f.periodEnd === period.periodEnd && f.version === period.version) ?? null;
  if (!filing) r.issues.push(`${document} ${period.periodEnd} v${period.version}: not in the CVM filing index`);

  const cash = readFixed(r, "cash");
  const stiValue = readFixed(r, "shortTermInvestments");
  const equityStakes = readFixed(r, "equityStakes");
  const currentDebt = readFixed(r, "currentDebt");
  const nonCurrentDebt = readFixed(r, "nonCurrentDebt");
  const equity = readFixed(r, "equity");
  const ga = readFixed(r, "generalAdministrativeExpenses");
  const equityMethod = readFixed(r, "equityMethodIncome");
  const financialExpenses = readFixed(r, "financialExpenses");
  const netIncome = readFixed(r, "netIncome");

  const dividends = readMappedFlow(period.rows, identity.accounts.dividendsReceived, "dividends received", r);
  const interestPaid = identity.accounts.interestPaid
    ? readMappedFlow(period.rows, identity.accounts.interestPaid, "interest paid", r)
    : null;

  const grossDebt = currentDebt !== null && nonCurrentDebt !== null ? currentDebt + nonCurrentDebt : null;
  const stiRow = r.accounts.find(a => a.code === FIXED_ACCOUNTS.shortTermInvestments.code);
  return {
    periodEnd: period.periodEnd,
    document,
    fiscalYear: Number(period.periodEnd.slice(0, 4)),
    quarter,
    flowPeriodStart: `${period.periodEnd.slice(0, 4)}-01-01`,
    filingDate: filing?.receivedDate ?? null,
    filingVersion: period.version,
    cvmDocumentId: filing?.documentId ?? null,
    basis: "individual",
    cash,
    shortTermInvestments: stiValue !== null && stiRow ? {
      value: stiValue,
      account: stiRow,
      classification: identity.shortTermInvestments.classification,
      includedInCash: false,
      note: identity.shortTermInvestments.note,
    } : null,
    equityStakes,
    grossDebt,
    netDebt: grossDebt !== null && cash !== null ? grossDebt - cash : null,
    equity,
    generalAdministrativeExpensesYtd: ga,
    equityMethodIncomeYtd: equityMethod,
    financialExpensesYtd: financialExpenses,
    netIncomeYtd: netIncome,
    dividendsReceivedYtd: dividends,
    interestPaidYtd: interestPaid,
    accounts: r.accounts,
    issues: r.issues,
  };
}

export type HoldingFlowField =
  | "generalAdministrativeExpensesYtd"
  | "equityMethodIncomeYtd"
  | "financialExpensesYtd"
  | "netIncomeYtd"
  | "dividendsReceivedYtd"
  | "interestPaidYtd";

export interface TtmValue {
  value: number | null;
  /** Statements combined, e.g. ["2026-06-30", "+2025-12-31", "-2025-06-30"]. */
  composition: string[];
  reason?: string;
}

/**
 * Trailing-twelve-month value at `periodEnd` from cumulative (YTD) filings.
 *
 *   annual (Q4):  TTM = FY
 *   interim (Qn): TTM = YTD(n, year) + FY(year − 1) − YTD(n, year − 1)
 *
 * Every input must exist, be parent-only, start its flows on Jan 1 and carry
 * the field; otherwise null (never zero). Overlapping YTD periods are never
 * summed.
 */
export function computeTtm(
  statements: readonly HoldingStatement[],
  periodEnd: string,
  field: HoldingFlowField,
): TtmValue {
  const find = (end: string) => statements.find(s => s.periodEnd === end && s.basis === "individual");
  const current = find(periodEnd);
  if (!current) return { value: null, composition: [], reason: `no statement for ${periodEnd}` };
  const usable = (s: HoldingStatement | undefined, end: string): string | null => {
    if (!s) return `no statement for ${end}`;
    if (s.flowPeriodStart !== `${end.slice(0, 4)}-01-01`) return `${end} flows are not cumulative from Jan 1`;
    if (s[field] === null) return `${field} unavailable for ${end}`;
    return null;
  };
  const currentProblem = usable(current, periodEnd);
  if (currentProblem) return { value: null, composition: [], reason: currentProblem };

  if (current.quarter === 4) return { value: current[field], composition: [periodEnd] };

  const prevYear = current.fiscalYear - 1;
  const prevFyEnd = `${prevYear}-12-31`;
  const prevYtdEnd = `${prevYear}${periodEnd.slice(4)}`;
  const prevFy = find(prevFyEnd);
  const prevYtd = find(prevYtdEnd);
  const problem = usable(prevFy, prevFyEnd) ?? usable(prevYtd, prevYtdEnd);
  if (problem) return { value: null, composition: [], reason: problem };

  return {
    value: current[field]! + prevFy![field]! - prevYtd![field]!,
    composition: [periodEnd, `+${prevFyEnd}`, `-${prevYtdEnd}`],
  };
}
