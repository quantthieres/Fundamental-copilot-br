import { describe, it, expect } from "vitest";
import {
  quarterFromPeriodEnd,
  diffOrNull,
  snapshotFromRows,
  buildQuarterlyRecords,
  type CumulativePeriodSnapshot,
} from "./itr-quarterly";
import type { RawCvmStatementRow, NormalizedFinancials } from "./types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BILLION = 1_000_000_000;
const TICKER  = "TEST3";

function row(
  accountCode:   string,
  accountName:   string,
  statementType: string,
  valueBillions: number,
  periodEndDate: string,
): RawCvmStatementRow {
  return {
    cvmCode:       "99999",
    companyName:   "TEST SA",
    statementType,
    accountCode,
    accountName,
    periodEndDate,
    fiscalYear:    new Date(`${periodEndDate}T00:00:00Z`).getUTCFullYear(),
    value:         valueBillions * BILLION,
  };
}

function snap(
  quarter: 1 | 2 | 3,
  periodEndDate: string,
  overrides: Partial<Omit<CumulativePeriodSnapshot, "quarter" | "periodEndDate" | "fiscalYear">> = {},
): CumulativePeriodSnapshot {
  return {
    periodEndDate,
    quarter,
    fiscalYear: new Date(`${periodEndDate}T00:00:00Z`).getUTCFullYear(),
    revenueCum:           null,
    ebitCum:              null,
    netIncomeCum:         null,
    operatingCashFlowCum: null,
    capexCum:             null,
    cash:                 null,
    totalDebt:            null,
    ...overrides,
  };
}

// ─── quarterFromPeriodEnd ─────────────────────────────────────────────────────

describe("quarterFromPeriodEnd", () => {
  it("returns 1 for March 31", () => {
    expect(quarterFromPeriodEnd("2024-03-31")).toBe(1);
  });

  it("returns 2 for June 30", () => {
    expect(quarterFromPeriodEnd("2024-06-30")).toBe(2);
  });

  it("returns 3 for September 30", () => {
    expect(quarterFromPeriodEnd("2024-09-30")).toBe(3);
  });

  it("returns null for December 31 (DFP, not ITR)", () => {
    expect(quarterFromPeriodEnd("2024-12-31")).toBeNull();
  });

  it("returns null for non-quarter-end months", () => {
    expect(quarterFromPeriodEnd("2024-02-29")).toBeNull();
    expect(quarterFromPeriodEnd("2024-07-31")).toBeNull();
  });
});

// ─── diffOrNull ───────────────────────────────────────────────────────────────

describe("diffOrNull", () => {
  it("subtracts two numbers", () => {
    expect(diffOrNull(250, 100)).toBe(150);
  });

  it("returns null when first operand is null", () => {
    expect(diffOrNull(null, 100)).toBeNull();
  });

  it("returns null when second operand is null", () => {
    expect(diffOrNull(250, null)).toBeNull();
  });

  it("returns null when both are null", () => {
    expect(diffOrNull(null, null)).toBeNull();
  });
});

// ─── A. Quarterly differencing ────────────────────────────────────────────────

describe("buildQuarterlyRecords — quarterly differencing (A)", () => {
  const snapshots: CumulativePeriodSnapshot[] = [
    snap(1, "2024-03-31", { revenueCum: 100 }),
    snap(2, "2024-06-30", { revenueCum: 250 }),
    snap(3, "2024-09-30", { revenueCum: 390 }),
  ];

  it("Q1 quarterly equals Q1 cumulative", () => {
    const records = buildQuarterlyRecords(TICKER, snapshots);
    const q1 = records.find(r => r.quarter === 1)!;
    expect(q1.revenue).toBeCloseTo(100, 5);
  });

  it("Q2 quarterly equals Q2 cumulative minus Q1 cumulative", () => {
    const records = buildQuarterlyRecords(TICKER, snapshots);
    const q2 = records.find(r => r.quarter === 2)!;
    expect(q2.revenue).toBeCloseTo(150, 5); // 250 - 100
  });

  it("Q3 quarterly equals Q3 cumulative minus Q2 cumulative", () => {
    const records = buildQuarterlyRecords(TICKER, snapshots);
    const q3 = records.find(r => r.quarter === 3)!;
    expect(q3.revenue).toBeCloseTo(140, 5); // 390 - 250
  });

  it("period labels are correct", () => {
    const records = buildQuarterlyRecords(TICKER, snapshots);
    expect(records.find(r => r.quarter === 1)?.period).toBe("2024Q1");
    expect(records.find(r => r.quarter === 2)?.period).toBe("2024Q2");
    expect(records.find(r => r.quarter === 3)?.period).toBe("2024Q3");
  });

  it("source is cvm_itr for Q1/Q2/Q3", () => {
    const records = buildQuarterlyRecords(TICKER, snapshots);
    for (const r of records) {
      expect(r.source).toBe("cvm_itr");
    }
  });
});

// ─── B. Q4 derivation ────────────────────────────────────────────────────────

describe("buildQuarterlyRecords — Q4 derivation (B)", () => {
  const snapshots: CumulativePeriodSnapshot[] = [
    snap(1, "2024-03-31", { revenueCum: 100 }),
    snap(2, "2024-06-30", { revenueCum: 250 }),
    snap(3, "2024-09-30", { revenueCum: 390 }),
  ];

  const annual: NormalizedFinancials = {
    ticker:     TICKER,
    fiscalYear: 2024,
    revenue:    520,
    cash:       10,
    totalDebt:  30,
  };

  it("Q4 revenue = annual - Q3 cumulative", () => {
    const records = buildQuarterlyRecords(TICKER, snapshots, annual);
    const q4 = records.find(r => r.quarter === 4)!;
    expect(q4).toBeDefined();
    expect(q4.revenue).toBeCloseTo(130, 5); // 520 - 390
  });

  it("Q4 source is cvm_dfp_derived_q4", () => {
    const records = buildQuarterlyRecords(TICKER, snapshots, annual);
    const q4 = records.find(r => r.quarter === 4)!;
    expect(q4.source).toBe("cvm_dfp_derived_q4");
  });

  it("Q4 period label and period end date are correct", () => {
    const records = buildQuarterlyRecords(TICKER, snapshots, annual);
    const q4 = records.find(r => r.quarter === 4)!;
    expect(q4.period).toBe("2024Q4");
    expect(q4.periodEndDate).toBe("2024-12-31");
  });

  it("Q4 is omitted when annual record is absent", () => {
    const records = buildQuarterlyRecords(TICKER, snapshots);
    expect(records.find(r => r.quarter === 4)).toBeUndefined();
  });

  it("Q4 is omitted when Q3 is absent", () => {
    const onlyQ1Q2: CumulativePeriodSnapshot[] = [
      snap(1, "2024-03-31", { revenueCum: 100 }),
      snap(2, "2024-06-30", { revenueCum: 250 }),
    ];
    const records = buildQuarterlyRecords(TICKER, onlyQ1Q2, annual);
    expect(records.find(r => r.quarter === 4)).toBeUndefined();
  });

  it("Q4 is omitted when annual fiscal year does not match Q3 fiscal year", () => {
    const wrongYear: NormalizedFinancials = { ...annual, fiscalYear: 2023 };
    const records = buildQuarterlyRecords(TICKER, snapshots, wrongYear);
    expect(records.find(r => r.quarter === 4)).toBeUndefined();
  });
});

// ─── C. Balance sheet items are not differenced ───────────────────────────────

describe("buildQuarterlyRecords — balance sheet not differenced (C)", () => {
  it("Q2 cash equals the reported Q2 cash, not Q2 - Q1", () => {
    const snapshots: CumulativePeriodSnapshot[] = [
      snap(1, "2024-03-31", { cash: 50 }),
      snap(2, "2024-06-30", { cash: 60 }),
    ];
    const records = buildQuarterlyRecords(TICKER, snapshots);
    const q2 = records.find(r => r.quarter === 2)!;
    expect(q2.cash).toBeCloseTo(60, 5); // point-in-time, not 60-50=10
  });

  it("Q2 totalDebt equals the reported Q2 totalDebt", () => {
    const snapshots: CumulativePeriodSnapshot[] = [
      snap(1, "2024-03-31", { totalDebt: 100 }),
      snap(2, "2024-06-30", { totalDebt: 120 }),
    ];
    const records = buildQuarterlyRecords(TICKER, snapshots);
    const q2 = records.find(r => r.quarter === 2)!;
    expect(q2.totalDebt).toBeCloseTo(120, 5);
  });

  it("Q2 netDebt is derived from Q2 totalDebt and Q2 cash", () => {
    const snapshots: CumulativePeriodSnapshot[] = [
      snap(1, "2024-03-31", { cash: 50, totalDebt: 100 }),
      snap(2, "2024-06-30", { cash: 60, totalDebt: 120 }),
    ];
    const records = buildQuarterlyRecords(TICKER, snapshots);
    const q2 = records.find(r => r.quarter === 2)!;
    expect(q2.netDebt).toBeCloseTo(60, 5); // 120 - 60
  });
});

// ─── D. Missing values remain null ───────────────────────────────────────────

describe("buildQuarterlyRecords — missing values remain null (D)", () => {
  it("capex remains null when not present in either quarter", () => {
    const snapshots: CumulativePeriodSnapshot[] = [
      snap(1, "2024-03-31", { revenueCum: 100 }), // capex stays null (default)
      snap(2, "2024-06-30", { revenueCum: 250 }),
    ];
    const records = buildQuarterlyRecords(TICKER, snapshots);
    const q2 = records.find(r => r.quarter === 2)!;
    expect(q2.capex).toBeNull();
  });

  it("freeCashFlow is null when capex is null", () => {
    const snapshots: CumulativePeriodSnapshot[] = [
      snap(1, "2024-03-31", { operatingCashFlowCum: 10 }), // capexCum stays null
      snap(2, "2024-06-30", { operatingCashFlowCum: 25 }),
    ];
    const records = buildQuarterlyRecords(TICKER, snapshots);
    const q2 = records.find(r => r.quarter === 2)!;
    expect(q2.freeCashFlow).toBeNull();
  });

  it("Q2 flow metric is null when Q1 cumulative value is null", () => {
    // Q1 revenue is null; Q2 cumulative revenue = 250
    // Cannot de-accumulate: Q2 quarterly revenue = null
    const snapshots: CumulativePeriodSnapshot[] = [
      snap(1, "2024-03-31"),                           // revenueCum = null
      snap(2, "2024-06-30", { revenueCum: 250 }),
    ];
    const records = buildQuarterlyRecords(TICKER, snapshots);
    const q2 = records.find(r => r.quarter === 2)!;
    expect(q2.revenue).toBeNull();
  });

  it("Q1 flow metric is null when not present in source rows", () => {
    const snapshots: CumulativePeriodSnapshot[] = [
      snap(1, "2024-03-31"), // all null
    ];
    const records = buildQuarterlyRecords(TICKER, snapshots);
    const q1 = records.find(r => r.quarter === 1)!;
    expect(q1.revenue).toBeNull();
    expect(q1.ebit).toBeNull();
    expect(q1.netIncome).toBeNull();
    expect(q1.operatingCashFlow).toBeNull();
    expect(q1.capex).toBeNull();
    expect(q1.freeCashFlow).toBeNull();
    expect(q1.cash).toBeNull();
    expect(q1.totalDebt).toBeNull();
    expect(q1.netDebt).toBeNull();
  });
});

// ─── snapshotFromRows ─────────────────────────────────────────────────────────

describe("snapshotFromRows", () => {
  it("returns null for a December period end (DFP, not ITR)", () => {
    const result = snapshotFromRows(TICKER, "2024-12-31", []);
    expect(result).toBeNull();
  });

  it("returns null for a non-standard period end month", () => {
    expect(snapshotFromRows(TICKER, "2024-05-31", [])).toBeNull();
  });

  it("maps revenue from DRE 3.01 for a Q1 period", () => {
    const rows = [row("3.01", "Receita", "DRE", 5, "2024-03-31")];
    const snap = snapshotFromRows(TICKER, "2024-03-31", rows)!;
    expect(snap).not.toBeNull();
    expect(snap.revenueCum).toBeCloseTo(5, 5);
    expect(snap.quarter).toBe(1);
    expect(snap.fiscalYear).toBe(2024);
  });

  it("sets missing fields to null (not undefined)", () => {
    const snap = snapshotFromRows(TICKER, "2024-03-31", [])!;
    expect(snap).not.toBeNull();
    expect(snap.revenueCum).toBeNull();
    expect(snap.capexCum).toBeNull();
    expect(snap.cash).toBeNull();
  });
});

// ─── freeCashFlow derived correctly after differencing ───────────────────────

describe("buildQuarterlyRecords — freeCashFlow after differencing", () => {
  it("Q2 freeCashFlow = Q2_ocf_quarterly - Q2_capex_quarterly", () => {
    const snapshots: CumulativePeriodSnapshot[] = [
      snap(1, "2024-03-31", { operatingCashFlowCum: 10, capexCum: 2 }),
      snap(2, "2024-06-30", { operatingCashFlowCum: 25, capexCum: 5 }),
    ];
    const records = buildQuarterlyRecords(TICKER, snapshots);
    const q2 = records.find(r => r.quarter === 2)!;
    // Q2 ocf quarterly = 25 - 10 = 15; capex quarterly = 5 - 2 = 3; fcf = 12
    expect(q2.operatingCashFlow).toBeCloseTo(15, 5);
    expect(q2.capex).toBeCloseTo(3, 5);
    expect(q2.freeCashFlow).toBeCloseTo(12, 5);
  });
});
