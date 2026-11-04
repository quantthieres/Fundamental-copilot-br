// Holding indicators — pure functions over the cached statements and the
// official portfolio snapshot.
//
// Descriptive only. Industrial metrics (revenue growth/CAGR, EBIT/FCF/CFO
// margins, EV multiples, capex ratios) and a headline P/L are deliberately
// absent: a holding's parent-only income is equity-method results, and its
// cash comes from dividends received.
//
// Every indicator lists the reference dates of its inputs — statements and
// portfolio snapshots have different dates and are never presented as
// simultaneous.
//
// No @/ imports — also used by tsx scripts.

import type { HoldingIndicator, HoldingIndicators, HoldingPortfolio, HoldingStatement } from "./holding-types";
import { computeTtm, type HoldingFlowField } from "./holding-statements";

function brl(value: number | null, asOf: (string | null)[], note?: string): HoldingIndicator {
  return { value, unit: "BRL", asOf: asOf.filter((d): d is string => !!d), ...(note ? { note } : {}) };
}

function ratio(value: number | null, asOf: (string | null)[], note?: string): HoldingIndicator {
  return { value: value === null || !Number.isFinite(value) ? null : Math.round(value * 1e6) / 1e6,
    unit: "ratio", asOf: asOf.filter((d): d is string => !!d), ...(note ? { note } : {}) };
}

function div(a: number | null, b: number | null): number | null {
  return a === null || b === null || b === 0 ? null : a / b;
}

/** Holding net debt: gross debt − cash (1.01.01). Investments are never netted. */
export function holdingNetDebt(st: Pick<HoldingStatement, "grossDebt" | "cash"> | null): number | null {
  if (!st || st.grossDebt === null || st.cash === null) return null;
  return st.grossDebt - st.cash;
}

/**
 * Largest investee concentration = largest positive investee value / Σ
 * positive investee values. Only `investment` components count: net cash and
 * "Demais Ativos e Passivos" are not investees, and the denominator is NOT
 * the official (net) sum of the parts.
 */
export function largestInvesteeConcentration(
  portfolio: HoldingPortfolio | null,
): { value: number | null; investee: string | null } {
  const positive = (portfolio?.components ?? []).filter(c => c.kind === "investment" && c.value > 0);
  const total = positive.reduce((s, c) => s + c.value, 0);
  const largest = positive.reduce<typeof positive[number] | null>((m, c) => (!m || c.value > m.value ? c : m), null);
  return { value: largest && total > 0 ? largest.value / total : null, investee: largest?.name ?? null };
}

export function computeHoldingIndicators(
  statements: readonly HoldingStatement[],
  portfolio: HoldingPortfolio | null,
): HoldingIndicators {
  const latest = statements.length ? statements[statements.length - 1] : null;
  const stDate = latest?.periodEnd ?? null;
  const ttm = (field: HoldingFlowField) => (stDate ? computeTtm(statements, stDate, field) : { value: null, composition: [] as string[], reason: "no statements" });
  const ttmAsOf = (t: { composition: string[] }) => t.composition.map(c => c.replace(/^[+-]/, ""));

  const pDate = portfolio?.portfolioReferenceDate ?? null;
  const investments = portfolio?.components.filter(c => c.kind === "investment") ?? [];
  const listed = investments.filter(c => c.valueBasis === "market_price");
  const unlisted = investments.filter(c => c.valueBasis !== "market_price");
  const concentration = largestInvesteeConcentration(portfolio);

  const dividends = ttm("dividendsReceivedYtd");
  const ga = ttm("generalAdministrativeExpensesYtd");
  const equityMethod = ttm("equityMethodIncomeYtd");
  const netIncome = ttm("netIncomeYtd");
  const finExp = ttm("financialExpensesYtd");
  const netDebt = holdingNetDebt(latest);
  const noDebt = latest?.grossDebt === 0;

  return {
    core: {
      officialPortfolioValue: brl(portfolio?.officialPortfolioValue ?? null, [pDate], "As published by the issuer"),
      listedInvestmentValue: brl(portfolio ? listed.reduce((s, c) => s + c.value, 0) : null, [pDate], "Investees valued at market price"),
      unlistedInvestmentValue: brl(portfolio ? unlisted.reduce((s, c) => s + c.value, 0) : null,
        [...new Set(unlisted.flatMap(c => [c.valueReferenceDate, ...(c.parts ?? []).map(p => p.referenceDate)]))],
        "Investees valued by the issuer at transaction price, book value or booked fair value"),
      largestInvesteeConcentration: {
        ...ratio(concentration.value, [pDate],
          "Share of positive investee value: largest investee / Σ positive investee values (excludes net cash and other assets/liabilities; not a share of the net sum of the parts)"),
        investee: concentration.investee,
      },
      holdingCash: brl(latest?.cash ?? null, [stDate], "Statement cash: CVM 1.01.01, parent-only; excludes investments booked under 1.01.02"),
      grossDebt: brl(latest?.grossDebt ?? null, [stDate], "Statement gross debt: CVM 2.01.04 + 2.02.01, parent-only"),
      netDebt: brl(netDebt, [stDate], "Statement net debt: gross debt − statement cash; negative = net cash. Not the issuer-published net cash of the portfolio publication"),
      dividendsReceivedTtm: brl(dividends.value, ttmAsOf(dividends), dividends.reason),
      generalAdministrativeExpensesTtm: brl(ga.value, ttmAsOf(ga), ga.reason),
      equityMethodIncomeTtm: brl(equityMethod.value, ttmAsOf(equityMethod), equityMethod.reason),
      netDebtToOfficialPortfolioValue: ratio(div(netDebt, portfolio?.officialPortfolioValue ?? null), [stDate, pDate],
        "Statement and portfolio dates differ"),
      officialMarketValue: brl(portfolio?.officialMarketValue.value ?? null, [portfolio?.officialMarketValue.priceReferenceDate ?? null],
        portfolio ? `Issuer method: ${portfolio.officialMarketValue.method}` : undefined),
      officialDiscount: ratio(portfolio?.officialDiscount.value ?? null, [pDate],
        "Issuer-published structural metric (market value / portfolio value − 1); not a valuation"),
    },
    secondary: {
      equity: brl(latest?.equity ?? null, [stDate], "Parent-only equity"),
      netIncomeTtm: brl(netIncome.value, ttmAsOf(netIncome), netIncome.reason),
      financialExpensesTtm: brl(finExp.value, ttmAsOf(finExp), finExp.reason),
      dividendsReceivedToFinancialExpenses: noDebt
        ? ratio(null, [stDate], "Not meaningful: the holding has no borrowings")
        : ratio(div(dividends.value, finExp.value === null ? null : Math.abs(finExp.value)), ttmAsOf(dividends)),
      grossDebtToDividendsReceived: ratio(div(latest?.grossDebt ?? null, dividends.value), [stDate, ...ttmAsOf(dividends)]),
      generalAdministrativeExpensesToDividendsReceived: ratio(div(ga.value === null ? null : Math.abs(ga.value), dividends.value), ttmAsOf(dividends)),
      standardizedClassWeightedMarketCap: brl(portfolio?.standardizedClassWeightedMarketCap ?? null, [pDate],
        portfolio?.standardizedClassWeightedMarketCapNote),
    },
  };
}
