// Pure quarterly logic: de-accumulation of ITR cumulative flow figures and
// Q4 derivation from annual DFP. No network or file I/O.
import type { RawCvmStatementRow, NormalizedFinancials, QuarterlyFinancialRecord } from "./types";
import { normalizeCvmRows } from "./normalizer";

// ─── Internal cumulative snapshot ─────────────────────────────────────────────

/**
 * Holds the raw cumulative (YTD) values extracted from one ITR period.
 * Flow fields (revenue, EBIT, etc.) are cumulative from the start of the
 * fiscal year. Balance sheet fields are point-in-time at period end.
 */
export type CumulativePeriodSnapshot = {
  periodEndDate: string;
  quarter: 1 | 2 | 3;
  fiscalYear: number;
  // Cumulative YTD flow metrics
  revenueCum: number | null;
  ebitCum: number | null;
  netIncomeCum: number | null;
  operatingCashFlowCum: number | null;
  capexCum: number | null;
  // Point-in-time balance sheet
  cash: number | null;
  totalDebt: number | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the fiscal quarter (1–3) for a given period end date, based on the
 * end month. Only March, June, and September are valid ITR period ends.
 * Returns null for December (DFP) or any non-standard month.
 */
export function quarterFromPeriodEnd(periodEndDate: string): 1 | 2 | 3 | null {
  // Parse as UTC to avoid timezone shifts.
  const month = new Date(`${periodEndDate}T00:00:00Z`).getUTCMonth() + 1;
  if (month === 3) return 1;
  if (month === 6) return 2;
  if (month === 9) return 3;
  return null;
}

/**
 * Returns a - b, or null if either operand is null.
 * Never converts null to zero.
 */
export function diffOrNull(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return a - b;
}

function fcfOrNull(ocf: number | null, capex: number | null): number | null {
  if (ocf === null || capex === null) return null;
  return ocf - capex;
}

function netDebtOrNull(totalDebt: number | null, cash: number | null): number | null {
  if (totalDebt === null || cash === null) return null;
  return totalDebt - cash;
}

// ─── Snapshot construction ────────────────────────────────────────────────────

/**
 * Builds a CumulativePeriodSnapshot from raw CVM rows belonging to a single
 * ITR period. Returns null for December (DFP) or non-standard quarter ends.
 *
 * Reuses normalizeCvmRows to extract values, then converts undefined → null
 * to honour the quarterly API contract ("null = missing, 0 = actual zero").
 */
export function snapshotFromRows(
  ticker: string,
  periodEndDate: string,
  rows: RawCvmStatementRow[],
): CumulativePeriodSnapshot | null {
  const quarter = quarterFromPeriodEnd(periodEndDate);
  if (quarter === null) return null;

  const fiscalYear = new Date(`${periodEndDate}T00:00:00Z`).getUTCFullYear();
  const n = normalizeCvmRows(ticker, fiscalYear, rows);

  return {
    periodEndDate,
    quarter,
    fiscalYear,
    revenueCum:             n.revenue            ?? null,
    ebitCum:                n.ebit               ?? null,
    netIncomeCum:           n.netIncome          ?? null,
    operatingCashFlowCum:   n.operatingCashFlow  ?? null,
    capexCum:               n.capex              ?? null,
    cash:                   n.cash               ?? null,
    totalDebt:              n.totalDebt          ?? null,
  };
}

// ─── Quarterly derivation ─────────────────────────────────────────────────────

/**
 * Converts an array of cumulative ITR snapshots (any mix of Q1/Q2/Q3 for one
 * fiscal year) into properly differenced quarterly records.
 *
 * Flow statement rules:
 *   Q1 quarterly = Q1 cumulative (base case)
 *   Q2 quarterly = Q2 cumulative − Q1 cumulative
 *   Q3 quarterly = Q3 cumulative − Q2 cumulative
 *
 * Balance sheet items (cash, totalDebt, netDebt) are point-in-time and are
 * never differenced.
 *
 * If the prior quarter's cumulative value is null for a flow metric, the
 * quarterly value for the current quarter is also null (cannot de-accumulate).
 *
 * Optionally derives Q4 when annualRecord for the same fiscal year is provided:
 *   Q4 = annual DFP value − Q3 cumulative value
 * Q4 balance sheet values come directly from the annual DFP record.
 */
export function buildQuarterlyRecords(
  ticker: string,
  snapshots: CumulativePeriodSnapshot[],
  annualRecord?: NormalizedFinancials,
): QuarterlyFinancialRecord[] {
  // Latest snapshot per quarter (in case of duplicate period entries).
  const byQuarter = new Map<1 | 2 | 3, CumulativePeriodSnapshot>();
  for (const s of snapshots) {
    const existing = byQuarter.get(s.quarter);
    if (!existing || s.periodEndDate > existing.periodEndDate) {
      byQuarter.set(s.quarter, s);
    }
  }

  const q1 = byQuarter.get(1);
  const q2 = byQuarter.get(2);
  const q3 = byQuarter.get(3);

  const records: QuarterlyFinancialRecord[] = [];

  if (q1) {
    const ocf   = q1.operatingCashFlowCum;
    const capex = q1.capexCum;
    records.push({
      ticker,
      fiscalYear:         q1.fiscalYear,
      quarter:            1,
      period:             `${q1.fiscalYear}Q1`,
      periodEndDate:      q1.periodEndDate,
      revenue:            q1.revenueCum,
      ebit:               q1.ebitCum,
      netIncome:          q1.netIncomeCum,
      operatingCashFlow:  ocf,
      capex,
      freeCashFlow:       fcfOrNull(ocf, capex),
      cash:               q1.cash,
      totalDebt:          q1.totalDebt,
      netDebt:            netDebtOrNull(q1.totalDebt, q1.cash),
      source:             "cvm_itr",
    });
  }

  if (q2) {
    const ocf   = diffOrNull(q2.operatingCashFlowCum, q1?.operatingCashFlowCum ?? null);
    const capex = diffOrNull(q2.capexCum,              q1?.capexCum             ?? null);
    records.push({
      ticker,
      fiscalYear:         q2.fiscalYear,
      quarter:            2,
      period:             `${q2.fiscalYear}Q2`,
      periodEndDate:      q2.periodEndDate,
      revenue:            diffOrNull(q2.revenueCum,           q1?.revenueCum           ?? null),
      ebit:               diffOrNull(q2.ebitCum,              q1?.ebitCum              ?? null),
      netIncome:          diffOrNull(q2.netIncomeCum,         q1?.netIncomeCum         ?? null),
      operatingCashFlow:  ocf,
      capex,
      freeCashFlow:       fcfOrNull(ocf, capex),
      cash:               q2.cash,
      totalDebt:          q2.totalDebt,
      netDebt:            netDebtOrNull(q2.totalDebt, q2.cash),
      source:             "cvm_itr",
    });
  }

  if (q3) {
    const ocf   = diffOrNull(q3.operatingCashFlowCum, q2?.operatingCashFlowCum ?? null);
    const capex = diffOrNull(q3.capexCum,              q2?.capexCum             ?? null);
    records.push({
      ticker,
      fiscalYear:         q3.fiscalYear,
      quarter:            3,
      period:             `${q3.fiscalYear}Q3`,
      periodEndDate:      q3.periodEndDate,
      revenue:            diffOrNull(q3.revenueCum,           q2?.revenueCum           ?? null),
      ebit:               diffOrNull(q3.ebitCum,              q2?.ebitCum              ?? null),
      netIncome:          diffOrNull(q3.netIncomeCum,         q2?.netIncomeCum         ?? null),
      operatingCashFlow:  ocf,
      capex,
      freeCashFlow:       fcfOrNull(ocf, capex),
      cash:               q3.cash,
      totalDebt:          q3.totalDebt,
      netDebt:            netDebtOrNull(q3.totalDebt, q3.cash),
      source:             "cvm_itr",
    });
  }

  // Q4 derivation: only when both annual DFP and Q3 cumulative are present.
  if (annualRecord && q3 && annualRecord.fiscalYear === q3.fiscalYear) {
    const q4Ocf   = diffOrNull(annualRecord.operatingCashFlow ?? null, q3.operatingCashFlowCum);
    const q4Capex = diffOrNull(annualRecord.capex             ?? null, q3.capexCum);
    // Balance sheet: use year-end values from annual DFP.
    const q4Cash      = annualRecord.cash      ?? null;
    const q4TotalDebt = annualRecord.totalDebt ?? null;

    records.push({
      ticker,
      fiscalYear:         q3.fiscalYear,
      quarter:            4,
      period:             `${q3.fiscalYear}Q4`,
      periodEndDate:      `${q3.fiscalYear}-12-31`,
      revenue:            diffOrNull(annualRecord.revenue    ?? null, q3.revenueCum),
      ebit:               diffOrNull(annualRecord.ebit       ?? null, q3.ebitCum),
      netIncome:          diffOrNull(annualRecord.netIncome  ?? null, q3.netIncomeCum),
      operatingCashFlow:  q4Ocf,
      capex:              q4Capex,
      freeCashFlow:       fcfOrNull(q4Ocf, q4Capex),
      cash:               q4Cash,
      totalDebt:          q4TotalDebt,
      netDebt:            netDebtOrNull(q4TotalDebt, q4Cash),
      source:             "cvm_dfp_derived_q4",
    });
  }

  return records;
}
