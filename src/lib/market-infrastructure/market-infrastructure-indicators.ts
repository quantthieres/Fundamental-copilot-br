// Market-infrastructure indicators — pure functions over the cached
// consolidated statements, segment snapshots, validated workbook KPIs,
// financial position and capital allocation.
//
// Deliberately absent (docs/market-infrastructure-model.md, "REJECT"):
// gross margin (3.02 is revenue taxes), cash − debt net debt and current
// liquidity (third-party balances), operating cash flow as performance,
// industrial FCF / FCF yield, EV multiples, P/L, ROIC, return on tangible
// equity, derived take rates, segment TTM, and any "free cash" built by
// guessing earmarked-resource exclusions. No valuation output of any kind.
//
// Every indicator is nullable, unit-explicit and lists the periods of its
// inputs; statements and workbook data keep their own reference dates.
//
// No @/ imports — also used by tsx scripts.

import type {
  CapitalAllocation,
  CoreIndicatorKey,
  FinancialPosition,
  MarketInfrastructureIndicator,
  MarketInfrastructureIndicators,
  MarketInfrastructureStatement,
  OperatingMetricsSnapshot,
  RevenueSegmentSnapshot,
  SecondaryIndicatorKey,
  ShareCountSnapshot,
  WorkbookValue,
} from "./market-infrastructure-types";
import { computeTtm, ebitdaYtd, oneYearEarlier, operatingResultYtd, quarterGrossRevenue, type FlowValue } from "./market-infrastructure-statements";
import { currentSegmentSnapshot } from "./market-infrastructure-segments";
import { outstandingSharesChange } from "./market-infrastructure-capital";

const CVM = "CVM DFP/ITR — demonstrações consolidadas";
const WORKBOOK = "B3 RI — Dados Trimestrais (planilha oficial)";

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

function div(a: number | null, b: number | null): number | null {
  return a === null || b === null || b === 0 ? null : a / b;
}

function brl(f: FlowValue | { value: number | null; composition: string[]; reason?: string }, source: string, note?: string): MarketInfrastructureIndicator {
  return {
    value: f.value,
    unit: "BRL",
    composition: f.composition,
    source,
    ...(f.value === null && f.reason ? { reason: f.reason } : {}),
    ...(note ? { note } : {}),
  };
}

function ratio(value: number | null, composition: string[], source: string, reason?: string, note?: string, unit: "ratio" | "multiple" = "ratio"): MarketInfrastructureIndicator {
  const v = value === null || !Number.isFinite(value) ? null : round6(value);
  return { value: v, unit, composition, source, ...(v === null && reason ? { reason } : {}), ...(note ? { note } : {}) };
}

function workbook(w: WorkbookValue | undefined, metrics: OperatingMetricsSnapshot | null): MarketInfrastructureIndicator {
  if (!metrics || !w) return { value: null, unit: "workbook_unit", composition: [], source: WORKBOOK, reason: "no validated workbook snapshot" };
  return {
    value: w.value,
    unit: "workbook_unit",
    publishedUnit: w.unit,
    composition: [metrics.quarterLabel],
    source: w.value === null ? WORKBOOK : `${WORKBOOK}: ${w.source}`,
    ...(w.value === null ? { reason: "value not published in this workbook" } : {}),
  };
}

const negate = (f: FlowValue): FlowValue => ({ ...f, value: f.value === null ? null : -f.value });
const asOf = (f: FlowValue) => f.composition;

/** Σ non-recurring operating lines (3.04.03 + 3.04.04 + 3.04.05) per statement. */
const nonRecurringYtd = (s: MarketInfrastructureStatement) =>
  s.impairmentLossesYtd === null || s.otherOperatingIncomeYtd === null || s.otherOperatingExpensesYtd === null
    ? null : s.impairmentLossesYtd + s.otherOperatingIncomeYtd + s.otherOperatingExpensesYtd;

const capexYtd = (s: MarketInfrastructureStatement) =>
  s.capexPropertyYtd === null || s.capexSoftwareYtd === null ? null : s.capexPropertyYtd + s.capexSoftwareYtd;

const attributableEquity = (s: MarketInfrastructureStatement | undefined) =>
  !s || s.equity === null || s.nonControllingInterests === null ? null : s.equity - s.nonControllingInterests;

/** Non-recurring operating lines ≥ 1% of TTM attributable net income are flagged (never adjusted). */
export const ONE_OFF_MATERIALITY = 0.01;

export interface IndicatorInputs {
  statements: readonly MarketInfrastructureStatement[];
  revenueSegments: readonly RevenueSegmentSnapshot[];
  operatingMetrics: OperatingMetricsSnapshot | null;
  financialPosition: FinancialPosition | null;
  capitalAllocation: CapitalAllocation;
  shareCounts: readonly ShareCountSnapshot[];
}

export function computeMarketInfrastructureIndicators(input: IndicatorInputs): MarketInfrastructureIndicators {
  const { statements, operatingMetrics: om, financialPosition: fp, capitalAllocation: ca } = input;
  const latest = statements[statements.length - 1] ?? null;
  const end = latest?.periodEnd ?? null;
  const none: FlowValue = { value: null, composition: [], reason: "no statements" };
  const ttm = (field: Parameters<typeof computeTtm>[2]) => (end ? computeTtm(statements, end, field) : none);

  const netRevenue = ttm("netRevenueYtd");
  const netRevenuePrior = end ? computeTtm(statements, oneYearEarlier(end), "netRevenueYtd") : none;
  const operating = ttm(operatingResultYtd);
  const ebitda = ttm(ebitdaYtd);
  const netIncome = ttm("netIncomeAttributableYtd");
  const segment = currentSegmentSnapshot(input.revenueSegments, end);
  const grossDebt = latest?.grossDebt ?? null;
  const shares = outstandingSharesChange(input.shareCounts);
  const core: Record<CoreIndicatorKey, MarketInfrastructureIndicator> = {
    netRevenueTtm: brl(netRevenue, `${CVM} 3.03`),
    netRevenueYoyGrowth: ratio(
      netRevenue.value !== null && netRevenuePrior.value !== null ? div(netRevenue.value - netRevenuePrior.value, netRevenuePrior.value) : null,
      [...asOf(netRevenue), ...asOf(netRevenuePrior).map(c => `vs ${c}`)],
      `${CVM} 3.03`,
      netRevenue.reason ?? netRevenuePrior.reason ?? "prior-year TTM unavailable",
      "Receita líquida TTM contra a TTM encerrada um ano antes."),
    grossRevenueCurrentPeriod: brl(end ? quarterGrossRevenue(statements, end) : none, `${CVM} 3.01`,
      "Receita bruta do trimestre (impostos sobre a receita somados de volta quando arquivados dentro de 3.01)."),
    revenueSegmentMix: segment
      ? {
        value: segment.reconciliation.sumOfLines,
        unit: "segment_mix",
        composition: [`${segment.periodKind} ${segment.periodStart}..${segment.periodEnd}`],
        source: `${CVM} 3.01.0x (${segment.source.document} ${segment.source.filingReferenceDate} v${segment.source.filingVersion})`,
        lines: segment.lines,
        note: "Participação de cada segmento na receita bruta de um único período e arquivamento (sem TTM por segmento).",
      }
      : { value: null, unit: "segment_mix", composition: [], source: `${CVM} 3.01.0x`, reason: "no validated segment snapshot for the latest filing" },
    derivativesAdv: workbook(om?.derivatives.adv, om),
    derivativesRpc: workbook(om?.derivatives.rpc, om),
    cashEquitiesAdtv: workbook(om?.cashEquities.adtv, om),
    cashEquitiesFeeMarginBps: workbook(om?.cashEquities.feeMarginBps, om),
    // Three official stocks, never summed: B3 publishes no aggregate.
    fixedIncomeBankingInstrumentsAverageStock: workbook(om?.fixedIncomeCredit.bankingInstrumentsAverageStock, om),
    fixedIncomeCorporateBondsAverageStock: workbook(om?.fixedIncomeCredit.corporateBondsAverageStock, om),
    fixedIncomeOtherAverageStock: workbook(om?.fixedIncomeCredit.otherAverageStock, om),
    operatingMargin: ratio(div(operating.value, netRevenue.value), asOf(operating), `${CVM} (3.03 + 3.04.02) / 3.03`,
      operating.reason ?? netRevenue.reason, "Conceito B3: (receita líquida + despesas) / receita líquida, TTM."),
    ebitdaTtm: brl(ebitda, `${CVM} 3.03 + 3.04.02 + D&A (DFC)`,
      "EBITDA operacional no conceito reportado pela B3: resultado operacional (3.03 + 3.04.02) + depreciação e amortização. O EBIT contábil (3.05) não é usado: inclui itens fora do resultado operacional da B3 (ex.: ganho na alienação da Dimensa e equivalência patrimonial no 2T26)."),
    ebitdaMargin: ratio(div(ebitda.value, netRevenue.value), asOf(ebitda), `${CVM}`, ebitda.reason ?? netRevenue.reason),
    netIncomeAttributableTtm: brl(netIncome, `${CVM} 3.11.01`),
    grossDebt: brl({ value: grossDebt, composition: end ? [end] : [], reason: "gross debt not validated" }, `${CVM} 2.01.04 + 2.02.01`),
    managedNetFinancialPosition: brl(
      { value: fp?.managedNetFinancialPosition ?? null, composition: fp ? [fp.referenceDate] : [], reason: fp?.issues[0] ?? "no financial position" },
      `${CVM} — conceito da nota de gestão de capital da B3`,
      "Posição financeira líquida gerida — não é caixa livre nem caixa líquido."),
    grossDebtToEbitdaTtm: ratio(div(grossDebt, ebitda.value), end ? [end, ...asOf(ebitda).map(c => `EBITDA ${c}`)] : [], `${CVM}`,
      ebitda.reason ?? "gross debt or EBITDA unavailable", "Dívida bruta / EBITDA TTM reproduzível (não o EBITDA recorrente ajustado da companhia).", "multiple"),
    shareholderDistributionsTtm: brl({ value: ca.distributionsPaidTtm, composition: ca.distributionsPaidTtm === null ? [] : ca.referencePeriod, reason: ca.issues.find(i => i.startsWith("distributions")) },
      `${CVM} DFC — Pagamento de Proventos`, "Dividendos e JCP pagos em caixa, valor positivo."),
    buybacksTtm: brl({ value: ca.buybacksTtm, composition: ca.buybacksTtm === null ? [] : ca.referencePeriod, reason: ca.issues.find(i => i.startsWith("buybacks")) },
      `${CVM} DFC — Recompra de Ações`, "Recompras pagas em caixa, valor positivo."),
    outstandingSharesChange: {
      value: shares.change,
      unit: "shares",
      composition: shares.latest && shares.comparable ? [shares.latest.referenceDate, `vs ${shares.comparable.referenceDate}`] : [],
      source: "CVM composicao_capital",
      parts: {
        latestOutstanding: shares.latest?.outstandingShares ?? null,
        comparableOutstanding: shares.comparable?.outstandingShares ?? null,
        changeRatio: shares.changeRatio,
      },
      ...(shares.change === null && shares.reason ? { reason: shares.reason } : {}),
    },
  };

  const capex = negate(ttm(capexYtd));
  const pretax = ttm("pretaxIncomeYtd");
  const tax = ttm("incomeTaxYtd");
  const eqNow = attributableEquity(latest ?? undefined);
  const eqPrior = end ? attributableEquity(statements.find(s => s.periodEnd === oneYearEarlier(end))) : null;
  const avgEquity = eqNow !== null && eqPrior !== null ? (eqNow + eqPrior) / 2 : null;
  const ec = om?.expenseComposition ?? null;

  const secondary: Record<SecondaryIndicatorKey, MarketInfrastructureIndicator> = {
    expenseComposition: ec && om
      ? { value: ec.total, unit: "BRL", composition: [om.quarterLabel], source: `${WORKBOOK}: IS (New Seg)`,
        parts: Object.fromEntries(ec.lines.map(l => [l.label, l.value])),
        note: "Despesas do trimestre por natureza, conforme a planilha da B3; total conciliado com 3.04.02." }
      : { value: null, unit: "BRL", composition: [], source: WORKBOOK, reason: "expense breakdown unavailable or not reconciled" },
    capexTtm: brl(capex, `${CVM} DFC — Aquisição de Imobilizado + Aquisição e Desenvolvimento de Softwares`,
      "Valor positivo. A B3 contabiliza parte do investimento em tecnologia como despesa."),
    returnOnEquity: ratio(div(netIncome.value, avgEquity), end ? [...asOf(netIncome), `equity ${end}`, `equity ${oneYearEarlier(end)}`] : [], `${CVM} 3.11.01 / (2.03 − 2.03.09)`,
      netIncome.reason ?? "average attributable equity unavailable",
      "Lucro atribuível TTM / média do PL atribuível (início e fim de 12 meses). O PL da B3 é dominado por ágio e reduzido por recompras e cancelamentos."),
    effectiveTaxRateTtm: ratio(tax.value !== null && pretax.value !== null ? div(-tax.value, pretax.value) : null, asOf(tax), `${CVM} −3.08 / 3.07`, tax.reason ?? pretax.reason),
    otcDerivativesAverageStock: workbook(om?.secondary.otcDerivativesAverageStock, om),
    securitiesLendingAverageOpenInterest: workbook(om?.secondary.securitiesLendingAverageOpenInterest, om),
    tesouroDiretoAverageStock: workbook(om?.secondary.tesouroDiretoAverageStock, om),
  };

  const oneOff = ttm(nonRecurringYtd);
  const lineTtm = (label: string, field: "impairmentLossesYtd" | "otherOperatingIncomeYtd" | "otherOperatingExpensesYtd") => {
    const v = ttm(field).value;
    return v ? `${label}: ${v}` : null;
  };
  const flagged = oneOff.value !== null && netIncome.value !== null && Math.abs(oneOff.value) >= Math.abs(netIncome.value) * ONE_OFF_MATERIALITY;
  return {
    core,
    secondary,
    oneOffFlag: {
      flagged,
      amountTtm: oneOff.value,
      lines: [
        lineTtm("3.04.03 Perdas pela Não Recuperabilidade de Ativos", "impairmentLossesYtd"),
        lineTtm("3.04.04 Outras Receitas Operacionais", "otherOperatingIncomeYtd"),
        lineTtm("3.04.05 Outras Despesas Operacionais", "otherOperatingExpensesYtd"),
      ].filter((l): l is string => l !== null),
    },
  };
}
