// Operating KPIs from the official quarterly workbook, validated against the
// consolidated CVM statements of the SAME quarter.
//
// A workbook snapshot is accepted only when the CVM statement for the
// workbook's latest quarter exists and the workbook's "Receita total" equals
// that quarter's consolidated gross revenue (3.01, revenue taxes added back
// where filed inside it) within REVENUE_CROSS_CHECK tolerance. A workbook is
// never combined with a statement of another quarter.
//
// Take rates are B3's own published unit economics (RPC, fee margin in bps);
// this model never divides revenue by volume.
//
// No @/ imports — also used by tsx scripts.

import type { ParsedB3Workbook } from "./b3-workbook";
import type { MarketInfrastructureStatement, OperatingMetricsSnapshot, WorkbookSource } from "./market-infrastructure-types";
import { ebitdaYtd, operatingResult, operatingResultYtd, quarterFromYtd, quarterGrossRevenue } from "./market-infrastructure-statements";

/** Relative tolerance of the workbook ↔ CVM revenue cross-check (0.01%). Do not loosen. */
export const REVENUE_CROSS_CHECK_RELATIVE_TOLERANCE = 0.0001;
/** Floor for tiny values: two R$-thousand rounding units (both sources publish R$ thousands). */
export const REVENUE_CROSS_CHECK_MIN_TOLERANCE_BRL = 2_000;

/** |workbook − CVM| ≤ max(R$ 2 thousand, 0.01% of the CVM quarter's 3.01). 2T26: R$308,139.2. */
export function revenueCrossCheckTolerance(cvm: number): number {
  return Math.max(REVENUE_CROSS_CHECK_MIN_TOLERANCE_BRL, Math.abs(cvm) * REVENUE_CROSS_CHECK_RELATIVE_TOLERANCE);
}

/** Official vs reproduced operating result/EBITDA: R$ 2 thousand (rounding of R$-thousand figures). */
export const OFFICIAL_RECONCILIATION_TOLERANCE_BRL = 2_000;
/** Operating margin: rounding of a ratio of R$-thousand figures. */
export const OPERATING_MARGIN_TOLERANCE = 0.0001;

export type KpiValidation =
  | { ok: true; snapshot: OperatingMetricsSnapshot }
  | { ok: false; reason: string };

/**
 * First quarter of B3's unified SNG (vehicle-lien registry) billing model.
 * Source: B3's 1T26/2T26 earnings releases state the unified SNG billing
 * began in 1T26, adding pass-through gross revenue in Soluções Analíticas de
 * Dados (Trillia) offset in "despesas atreladas ao faturamento" (2T26:
 * R$27.5mn). Methodology note only — no adjusted revenue series is created.
 */
export const SNG_PASS_THROUGH_START_PERIOD = "2026-Q1";

/** "YYYY-Qn" of a calendar quarter-end date. */
export function quarterPeriodKey(quarterEnd: string): string {
  return `${quarterEnd.slice(0, 4)}-Q${Math.ceil(Number(quarterEnd.slice(5, 7)) / 3)}`;
}

export function isSngPassThroughPeriod(quarterEnd: string): boolean {
  return quarterPeriodKey(quarterEnd) >= SNG_PASS_THROUGH_START_PERIOD;
}

export const SNG_PASS_THROUGH_NOTE =
  "A partir do 1T26, a mudança de faturamento do SNG (gravames de veículos) eleva receita bruta e despesas atreladas ao faturamento no mesmo valor; a receita líquida segue como medida de escala e nenhuma série ajustada é criada.";

export function validateOperatingMetrics(
  parsed: ParsedB3Workbook,
  source: WorkbookSource,
  statements: readonly MarketInfrastructureStatement[],
): KpiValidation {
  const st = statements.find(s => s.periodEnd === parsed.quarterEnd);
  if (!st) return { ok: false, reason: `no consolidated statement for the workbook quarter ${parsed.quarterLabel} (${parsed.quarterEnd}) — not combined with another quarter` };

  const cvm = quarterGrossRevenue(statements, parsed.quarterEnd);
  if (cvm.value === null) return { ok: false, reason: `CVM gross revenue for ${parsed.quarterEnd} unavailable (${cvm.reason ?? "?"})` };
  const tolerance = revenueCrossCheckTolerance(cvm.value);
  const difference = parsed.incomeStatement.totalRevenue - cvm.value;
  const revenueCrossCheck = {
    workbookTotalRevenue: parsed.incomeStatement.totalRevenue,
    cvmGrossRevenueQuarter: cvm.value,
    cvmComposition: cvm.composition,
    difference,
    tolerance,
    passed: Math.abs(difference) <= tolerance,
  };
  if (!revenueCrossCheck.passed) {
    return { ok: false, reason: `workbook total revenue ${parsed.incomeStatement.totalRevenue} ≠ CVM 3.01 ${cvm.value} for ${parsed.quarterLabel} (difference ${difference})` };
  }

  // Reproduced quarter figures (diagnostic reconciliation to B3's own numbers).
  const q = st.quarterFlows;
  const opQuarter = q
    ? { value: operatingResult(q.netRevenue, q.operatingExpenses) }
    : quarterFromYtd(statements, st.periodEnd, operatingResultYtd);
  const opexQuarter = q ? q.operatingExpenses : quarterFromYtd(statements, st.periodEnd, "operatingExpensesYtd").value;
  const netRevenueQuarter = q ? q.netRevenue : quarterFromYtd(statements, st.periodEnd, "netRevenueYtd").value;
  const ebitdaQuarter = quarterFromYtd(statements, st.periodEnd, ebitdaYtd).value;
  const reproducedMargin = opQuarter.value !== null && netRevenueQuarter ? opQuarter.value / netRevenueQuarter : null;

  const rec = (label: string, workbook: number | null, reproduced: number | null, tol: number) => {
    const difference = workbook !== null && reproduced !== null ? workbook - reproduced : null;
    return { label, workbook, reproduced, difference, tolerance: tol, passed: difference === null ? null : Math.abs(difference) <= tol };
  };
  const officialReconciliation = [
    rec("Resultado operacional (trimestre)", parsed.incomeStatement.operatingResult, opQuarter.value, OFFICIAL_RECONCILIATION_TOLERANCE_BRL),
    rec("Margem operacional (trimestre)", parsed.incomeStatement.operatingMargin, reproducedMargin, OPERATING_MARGIN_TOLERANCE),
    rec("EBITDA (trimestre)", parsed.incomeStatement.ebitda, ebitdaQuarter, OFFICIAL_RECONCILIATION_TOLERANCE_BRL),
  ];

  let expenseComposition: OperatingMetricsSnapshot["expenseComposition"] = null;
  const lines = parsed.incomeStatement.expenseLines;
  const total = parsed.incomeStatement.expenses;
  if (lines && total !== null) {
    const sum = lines.reduce((s, l) => s + l.value, 0);
    const reconciled = Math.abs(sum - total) <= OFFICIAL_RECONCILIATION_TOLERANCE_BRL &&
      opexQuarter !== null && Math.abs(total - opexQuarter) <= OFFICIAL_RECONCILIATION_TOLERANCE_BRL;
    expenseComposition = reconciled ? { lines, total, reconciled } : null;
  }

  const notes = [...parsed.notes];
  if (isSngPassThroughPeriod(parsed.quarterEnd)) notes.push(SNG_PASS_THROUGH_NOTE);

  return {
    ok: true,
    snapshot: {
      quarterEnd: parsed.quarterEnd,
      quarterLabel: parsed.quarterLabel,
      source,
      derivatives: parsed.derivatives,
      cashEquities: parsed.cashEquities,
      fixedIncomeCredit: parsed.fixedIncomeCredit,
      secondary: parsed.secondary,
      expenseComposition,
      revenueCrossCheck,
      officialReconciliation,
      notes: [...notes, ...parsed.issues.map(i => `issue: ${i}`)],
    },
  };
}
