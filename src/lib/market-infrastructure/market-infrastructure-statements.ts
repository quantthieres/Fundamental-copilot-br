// Consolidated B3 statements from CVM filings.
//
// Fixed CVM accounts (ST_CONTA_FIXA = S) are read by code and checked against
// their standard description. Issuer-specific balance-sheet lines are read by
// code + verified description; drifting cash-flow lines by verified
// description inside their section. Every reader fails closed — the field
// stays null, with an issue — when a row is missing, duplicated with
// conflicting values, relabelled, or its description moved to another code.
// No missing value becomes zero.
//
// Revenue layout: B3's 3.02 "Custo dos Bens e/ou Serviços Vendidos" holds
// only revenue taxes (PIS/Cofins, ISS) and 3.03 "Resultado Bruto" is net
// revenue. ITRs 2019–2022 filed those taxes inside 3.01 instead (3.02 = 0);
// gross revenue therefore adds back any tax sub-line found inside 3.01.
//
// No @/ imports — also used by tsx scripts.

import type { CvmRow, FilingIndexEntry, RawFiling } from "./market-infrastructure-cvm-rows";
import type { MarketInfrastructureStatement, QuarterFlows, StatementAccountRef } from "./market-infrastructure-types";
import {
  CASH_FLOW_LINES,
  DERIVATIVE_LIABILITY_LINES,
  FIXED_ACCOUNTS,
  REVENUE_TAX_DESCRIPTIONS,
  THIRD_PARTY_LINES,
  matchesAny,
  normalizeDescription,
  type FixedAccountKey,
  type SectionLine,
  type VerifiedLine,
} from "./market-infrastructure-identity";

export interface Reader {
  rows: readonly CvmRow[];
  accounts: StatementAccountRef[];
  issues: string[];
}

function record(r: Reader, row: CvmRow): number {
  r.accounts.push({ statement: row.statement, code: row.code, description: row.description, value: row.value });
  return row.value;
}

function single(r: Reader, found: CvmRow[], label: string): CvmRow | null {
  if (found.length === 0) {
    r.issues.push(`${label}: not filed`);
    return null;
  }
  if (new Set(found.map(f => f.value)).size > 1 || new Set(found.map(f => f.description)).size > 1) {
    r.issues.push(`${label}: ${found.length} conflicting rows — ambiguous`);
    return null;
  }
  return found[0];
}

/** A fixed CVM account: code, fixed flag and standard description must all match. */
export function readFixed(r: Reader, key: FixedAccountKey, opts: { record?: boolean } = {}): number | null {
  const spec = FIXED_ACCOUNTS[key];
  const row = single(r, r.rows.filter(x => x.code === spec.code && x.statement.startsWith(spec.statement)), `${spec.code} ${spec.description}`);
  if (!row) return null;
  if (!row.fixed || normalizeDescription(row.description) !== normalizeDescription(spec.description)) {
    r.issues.push(`${spec.code}: expected fixed account "${spec.description}", found "${row.description}"`);
    return null;
  }
  return opts.record === false ? row.value : record(r, row);
}

/**
 * An issuer-specific line read by code + verified description. Fails closed
 * when the code is missing/ambiguous, relabelled, or a verified description
 * appears under a code other than `code` and `sharedCodes` (the line moved).
 */
export function readVerified(
  r: Reader,
  statementPrefix: string,
  line: VerifiedLine,
  label: string,
  sharedCodes: readonly string[] = [],
): number | null {
  const inStatement = r.rows.filter(x => x.statement.startsWith(statementPrefix));
  const elsewhere = inStatement.filter(x => x.code !== line.code && !sharedCodes.includes(x.code) && matchesAny(line.descriptions, x.description));
  if (elsewhere.length > 0) {
    r.issues.push(`${label}: verified description now also at ${[...new Set(elsewhere.map(e => e.code))].join(", ")} — mapping must be re-verified`);
    return null;
  }
  const row = single(r, inStatement.filter(x => x.code === line.code), `${label} (${line.code})`);
  if (!row) return null;
  if (!matchesAny(line.descriptions, row.description)) {
    r.issues.push(`${label}: ${line.code} is now "${row.description}" — mapping must be re-verified`);
    return null;
  }
  return record(r, row);
}

/**
 * A cash-flow line whose code drifts: exactly one direct child of `section`
 * must carry a verified description. Zero matches → null ("not filed"),
 * several → null (ambiguous). Never zero.
 *
 * Several matching rows are never summed just because their descriptions
 * match (FY2023 files "Pagamento de Proventos" at both 6.03.07 and 6.03.08;
 * 1T19 files two dividend/JCP lines). Summing would require the rows to
 * have distinct validated accounting roles AND a hierarchy proving they are
 * additive components — neither is available, so those periods stay null.
 */
export function readSectionLine(r: Reader, line: SectionLine, label: string): number | null {
  const depth = line.section.split(".").length;   // "6.02." → 3 parts → children have 3 segments
  const children = r.rows.filter(x => x.statement.startsWith("DFC") && x.code.startsWith(line.section) && x.code.split(".").length === depth);
  const found = children.filter(x => matchesAny(line.descriptions, x.description));
  if (found.length > 1 && new Set(found.map(f => f.code)).size > 1) {
    r.issues.push(`${label}: ${found.length} lines under ${line.section}* match — ambiguous`);
    return null;
  }
  const row = single(r, found, `${label} (${line.section}*)`);
  return row ? record(r, row) : null;
}

const QUARTER_START: Record<string, string> = { "03-31": "01-01", "06-30": "04-01", "09-30": "07-01" };

export function quarterOf(periodEnd: string): 1 | 2 | 3 | 4 | null {
  switch (periodEnd.slice(5)) {
    case "03-31": return 1;
    case "06-30": return 2;
    case "09-30": return 3;
    case "12-31": return 4;
    default: return null;
  }
}

interface RevenueBlock {
  grossRevenue: number | null;
  revenueDeductions: number | null;
  netRevenue: number | null;
  operatingExpenses: number | null;
}

/** Gross/net revenue and operating expenses from one set of DRE rows (YTD or single quarter). */
export function readRevenueBlock(r: Reader, label: string): RevenueBlock {
  const r301 = readFixed(r, "grossRevenue");
  const r302 = readFixed(r, "revenueDeductions");
  const netRevenue = readFixed(r, "netRevenue");
  const selling = readFixed(r, "sellingExpenses", { record: false });
  const opex = readFixed(r, "operatingExpenses");

  const children = (parent: string) => r.rows.filter(x => x.statement === "DRE" && x.code.startsWith(`${parent}.`) && x.code.split(".").length === 3);
  const taxInside301 = children("3.01").filter(x => matchesAny(REVENUE_TAX_DESCRIPTIONS, x.description));
  const nonTax302 = children("3.02").filter(x => !matchesAny(REVENUE_TAX_DESCRIPTIONS, x.description));

  let grossRevenue: number | null = null;
  let revenueDeductions: number | null = null;
  if (nonTax302.length > 0) {
    r.issues.push(`${label}: 3.02 holds non-tax lines (${nonTax302.map(x => x.description).join(", ")}) — gross revenue not derivable`);
  } else if (r301 !== null && r302 !== null && netRevenue !== null) {
    const taxes = taxInside301.reduce((s, x) => s + record(r, x), 0);
    if (r301 + r302 !== netRevenue) {
      r.issues.push(`${label}: 3.01 + 3.02 ≠ 3.03 — revenue layout must be re-verified`);
    } else {
      grossRevenue = r301 - taxes;
      revenueDeductions = r302 + taxes;
      if (taxInside301.length > 0) r.issues.push(`note: ${label} revenue taxes filed inside 3.01 (${taxInside301.map(x => x.code).join(", ")}) — gross revenue adds them back`);
    }
  }

  let operatingExpenses = opex;
  if (selling !== null && selling !== 0) {
    r.issues.push(`${label}: 3.04.01 Despesas com Vendas = ${selling} — B3 files every operating expense in 3.04.02; operating result not derivable`);
    operatingExpenses = null;
  }
  return { grossRevenue, revenueDeductions, netRevenue, operatingExpenses };
}

/** Builds one consolidated statement. Null for a non-calendar period or a document/quarter mismatch. */
export function buildStatement(filing: RawFiling, index: readonly FilingIndexEntry[]): MarketInfrastructureStatement | null {
  const periodEnd = filing.filingReferenceDate;
  const quarter = quarterOf(periodEnd);
  if (quarter === null) return null;
  if ((filing.document === "DFP") !== (quarter === 4)) return null;

  const year = periodEnd.slice(0, 4);
  const yearStart = `${year}-01-01`;
  const current = filing.rows.filter(x => x.order === "current" && x.periodEnd === periodEnd);
  const ytdRows = current.filter(x => x.periodStart === "" || x.periodStart === yearStart);
  const accounts: StatementAccountRef[] = [];
  const issues: string[] = [];
  const r: Reader = { rows: ytdRows, accounts, issues };

  const entry = index.find(f => f.document === filing.document && f.filingReferenceDate === periodEnd && f.version === filing.version) ?? null;
  if (!entry) issues.push(`${filing.document} ${periodEnd} v${filing.version}: not in the CVM filing index`);

  const revenue = readRevenueBlock(r, "YTD");

  let quarterFlows: QuarterFlows | null = null;
  if (quarter === 1) {
    quarterFlows = { periodStart: yearStart, grossRevenue: revenue.grossRevenue, netRevenue: revenue.netRevenue, operatingExpenses: revenue.operatingExpenses };
  } else if (quarter !== 4) {
    const qStart = `${year}-${QUARTER_START[periodEnd.slice(5)]}`;
    const qRows = current.filter(x => x.statement === "DRE" && x.periodStart === qStart);
    const qr: Reader = { rows: qRows, accounts: [], issues };
    const q = readRevenueBlock(qr, `quarter ${qStart}`);
    quarterFlows = { periodStart: qStart, grossRevenue: q.grossRevenue, netRevenue: q.netRevenue, operatingExpenses: q.operatingExpenses };
  }

  // Balance sheet.
  const balanceSheetCash = readFixed(r, "balanceSheetCash");
  const investmentKeys = ["currentInvestments", "ltInvestmentsFvtpl", "ltInvestmentsFvoci", "ltInvestmentsAmortized"] as const;
  const investmentValues = investmentKeys.map(k => readFixed(r, k));
  const financialInvestmentAccounts = accounts.filter(a => investmentKeys.some(k => FIXED_ACCOUNTS[k].code === a.code));
  const financialInvestments = investmentValues.some(v => v === null) ? null : investmentValues.reduce<number>((s, v) => s + v!, 0);
  const currentDebt = readFixed(r, "currentDebt");
  const nonCurrentDebt = readFixed(r, "nonCurrentDebt");
  const equity = readFixed(r, "equity");
  const nonControllingInterests = readFixed(r, "nonControllingInterests");

  const collateralReceived = readVerified(r, "BPP", THIRD_PARTY_LINES.collateralReceived, "collateral received");
  const custodyPayments = readVerified(r, "BPP", THIRD_PARTY_LINES.custodyPayments, "custody payments");
  const derivativeLiabilities = readDerivativeLiabilities(r);

  // Cash-flow statement.
  const depreciationAmortization = readSectionLine(r, CASH_FLOW_LINES.depreciationAmortization, "depreciation and amortization");
  const operatingCashFlow = readFixed(r, "operatingCashFlow");
  const capexProperty = readSectionLine(r, CASH_FLOW_LINES.capexProperty, "acquisition of PP&E");
  const capexSoftware = readSectionLine(r, CASH_FLOW_LINES.capexSoftware, "acquisition/development of software");
  const distributionsPaid = readSectionLine(r, CASH_FLOW_LINES.distributionsPaid, "distributions paid");
  const buybacks = readSectionLine(r, CASH_FLOW_LINES.buybacks, "share repurchases");
  const opening = readFixed(r, "openingCash");
  const change = readFixed(r, "cashChange");
  const closing = readFixed(r, "closingCash");
  let closingCash: number | null = null;
  if (opening !== null && change !== null && closing !== null) {
    if (opening + change === closing) closingCash = closing;
    else issues.push("6.05.01 + 6.05 ≠ 6.05.02 — cash-flow closing cash not used");
  }

  return {
    periodEnd,
    document: filing.document,
    fiscalYear: Number(year),
    quarter,
    flowPeriodStart: yearStart,
    filingDate: entry?.receivedDate ?? null,
    filingVersion: filing.version,
    cvmDocumentId: entry?.documentId ?? null,
    basis: "consolidated",

    grossRevenueYtd: revenue.grossRevenue,
    revenueDeductionsYtd: revenue.revenueDeductions,
    netRevenueYtd: revenue.netRevenue,
    operatingExpensesYtd: revenue.operatingExpenses,
    impairmentLossesYtd: readFixed(r, "impairmentLosses"),
    otherOperatingIncomeYtd: readFixed(r, "otherOperatingIncome"),
    otherOperatingExpensesYtd: readFixed(r, "otherOperatingExpenses"),
    equityMethodIncomeYtd: readFixed(r, "equityMethodIncome"),
    ebitYtd: readFixed(r, "ebit"),
    financialResultYtd: readFixed(r, "financialResult"),
    pretaxIncomeYtd: readFixed(r, "pretaxIncome"),
    incomeTaxYtd: readFixed(r, "incomeTax"),
    netIncomeConsolidatedYtd: readFixed(r, "netIncomeConsolidated"),
    netIncomeAttributableYtd: readFixed(r, "netIncomeAttributable"),

    quarterFlows,

    depreciationAmortizationYtd: depreciationAmortization,
    operatingCashFlowReportedYtd: operatingCashFlow,
    capexPropertyYtd: capexProperty,
    capexSoftwareYtd: capexSoftware,
    distributionsPaidYtd: distributionsPaid,
    buybacksYtd: buybacks,
    cashFlowStatementClosingCash: closingCash,

    balanceSheetCashReported: balanceSheetCash,
    financialInvestments,
    financialInvestmentAccounts,
    grossDebt: currentDebt !== null && nonCurrentDebt !== null ? currentDebt + nonCurrentDebt : null,
    equity,
    nonControllingInterests,
    collateralReceived,
    custodyPayments,
    derivativeLiabilities,

    accounts,
    issues,
  };
}

/**
 * Current + non-current derivative liabilities. The non-current line is only
 * filed in some periods; its absence counts as zero only when the parent
 * 2.02.02.02 "Outros" equals the sum of the children that are filed.
 */
function readDerivativeLiabilities(r: Reader): number | null {
  const { current, nonCurrent } = DERIVATIVE_LIABILITY_LINES;
  const shared = [current.code, nonCurrent.code];
  const cur = readVerified(r, "BPP", current, "derivative liabilities (current)", shared);
  if (cur === null) return null;
  if (r.rows.some(x => x.statement === "BPP" && x.code === nonCurrent.code)) {
    const nc = readVerified(r, "BPP", nonCurrent, "derivative liabilities (non-current)", shared);
    return nc === null ? null : cur + nc;
  }
  const parent = readFixed(r, "otherNonCurrentOthers", { record: false });
  const children = r.rows.filter(x => x.statement === "BPP" && x.code.startsWith("2.02.02.02.") && x.code.split(".").length === 5);
  if (parent === null || parent !== children.reduce((s, x) => s + x.value, 0)) {
    r.issues.push(`derivative liabilities (non-current): ${nonCurrent.code} not filed and 2.02.02.02 ≠ Σ filed children — absence not provable`);
    return null;
  }
  return cur;
}

// ─── TTM and quarter values ───────────────────────────────────────────────────

export type FlowField =
  | "grossRevenueYtd"
  | "netRevenueYtd"
  | "operatingExpensesYtd"
  | "impairmentLossesYtd"
  | "otherOperatingIncomeYtd"
  | "otherOperatingExpensesYtd"
  | "pretaxIncomeYtd"
  | "incomeTaxYtd"
  | "netIncomeAttributableYtd"
  | "depreciationAmortizationYtd"
  | "capexPropertyYtd"
  | "capexSoftwareYtd"
  | "distributionsPaidYtd"
  | "buybacksYtd";

export interface FlowValue {
  value: number | null;
  /** Statements combined, e.g. ["2026-06-30", "+2025-12-31", "-2025-06-30"]. */
  composition: string[];
  reason?: string;
}

type FlowGetter = (s: MarketInfrastructureStatement) => number | null;

const getter = (field: FlowField | FlowGetter): FlowGetter => (typeof field === "function" ? field : s => s[field]);

function findStatement(statements: readonly MarketInfrastructureStatement[], end: string) {
  return statements.find(s => s.periodEnd === end && s.basis === "consolidated");
}

function usable(s: MarketInfrastructureStatement | undefined, end: string, get: FlowGetter): string | null {
  if (!s) return `no statement for ${end}`;
  if (s.flowPeriodStart !== `${end.slice(0, 4)}-01-01`) return `${end} flows are not cumulative from Jan 1`;
  if (get(s) === null) return `value unavailable for ${end}`;
  return null;
}

/**
 * Trailing-twelve-month value at `periodEnd` from cumulative (YTD) filings,
 * each period read from its own filing:
 *
 *   annual (Q4):  TTM = FY
 *   interim (Qn): TTM = YTD(n, year) + FY(year − 1) − YTD(n, year − 1)
 *
 * Every input must exist and carry the value; otherwise null (never zero).
 * Overlapping YTD periods are never summed.
 */
export function computeTtm(
  statements: readonly MarketInfrastructureStatement[],
  periodEnd: string,
  field: FlowField | FlowGetter,
): FlowValue {
  const get = getter(field);
  const current = findStatement(statements, periodEnd);
  const problem = usable(current, periodEnd, get);
  if (problem) return { value: null, composition: [], reason: problem };
  if (current!.quarter === 4) return { value: get(current!), composition: [periodEnd] };

  const prevYear = current!.fiscalYear - 1;
  const prevFyEnd = `${prevYear}-12-31`;
  const prevYtdEnd = `${prevYear}${periodEnd.slice(4)}`;
  const prevFy = findStatement(statements, prevFyEnd);
  const prevYtd = findStatement(statements, prevYtdEnd);
  const missing = usable(prevFy, prevFyEnd, get) ?? usable(prevYtd, prevYtdEnd, get);
  if (missing) return { value: null, composition: [], reason: missing };
  return {
    value: get(current!)! + get(prevFy!)! - get(prevYtd!)!,
    composition: [periodEnd, `+${prevFyEnd}`, `-${prevYtdEnd}`],
  };
}

/** Same-quarter-end date one year earlier. */
export function oneYearEarlier(periodEnd: string): string {
  return `${Number(periodEnd.slice(0, 4)) - 1}${periodEnd.slice(4)}`;
}

function previousQuarterEnd(periodEnd: string): string {
  const y = periodEnd.slice(0, 4);
  return { "06-30": `${y}-03-31`, "09-30": `${y}-06-30`, "12-31": `${y}-09-30` }[periodEnd.slice(5)] ?? "";
}

/**
 * Single-quarter value of a YTD field: Q1 = YTD; otherwise YTD(n) − YTD(n−1),
 * each from its own filing. Used where the filing has no single-quarter row
 * (cash-flow statement, DFP Q4).
 */
export function quarterFromYtd(
  statements: readonly MarketInfrastructureStatement[],
  periodEnd: string,
  field: FlowField | FlowGetter,
): FlowValue {
  const get = getter(field);
  const current = findStatement(statements, periodEnd);
  const problem = usable(current, periodEnd, get);
  if (problem) return { value: null, composition: [], reason: problem };
  if (current!.quarter === 1) return { value: get(current!), composition: [periodEnd] };
  const prevEnd = previousQuarterEnd(periodEnd);
  const prev = findStatement(statements, prevEnd);
  const missing = usable(prev, prevEnd, get);
  if (missing) return { value: null, composition: [], reason: missing };
  return { value: get(current!)! - get(prev!)!, composition: [periodEnd, `-${prevEnd}`] };
}

/** Single-quarter gross revenue: the filing's own quarter rows, else FY − 9M (Q4). */
export function quarterGrossRevenue(statements: readonly MarketInfrastructureStatement[], periodEnd: string): FlowValue {
  const st = findStatement(statements, periodEnd);
  if (st?.quarterFlows && st.quarterFlows.grossRevenue !== null) {
    return { value: st.quarterFlows.grossRevenue, composition: [`${st.quarterFlows.periodStart}..${periodEnd}`] };
  }
  return quarterFromYtd(statements, periodEnd, "grossRevenueYtd");
}

/** B3's operating result: net revenue (3.03) + operating expenses (3.04.02, negative). */
export function operatingResult(netRevenue: number | null, operatingExpenses: number | null): number | null {
  return netRevenue === null || operatingExpenses === null ? null : netRevenue + operatingExpenses;
}

export const operatingResultYtd: FlowGetter = s => operatingResult(s.netRevenueYtd, s.operatingExpensesYtd);

/**
 * Reproducible EBITDA — B3's reported operating EBITDA concept: operating
 * result (3.03 + 3.04.02) + D&A (6.01.01.02 add-back, positive). Reproduces
 * B3's published 2T26 EBITDA (R$1,885,398k). CVM 3.05 stays stored as
 * accounting EBIT but is NOT used here: it includes items outside B3's
 * operating-result line (3.04.03–3.04.06 — in 2T26 the R$123.9mn Dimensa
 * disposal gain and equity-method income), so 3.05 + D&A (R$2,010.1mn in
 * 2T26) would not reconcile.
 */
export const ebitdaYtd: FlowGetter = s => {
  const op = operatingResultYtd(s);
  return op === null || s.depreciationAmortizationYtd === null ? null : op + s.depreciationAmortizationYtd;
};
