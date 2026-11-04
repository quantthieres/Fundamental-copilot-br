// Market-infrastructure model — cache schema (B3SA3 only in Phase 1).
//
// Descriptive only: the cache stores B3's consolidated CVM statements, the
// official quarterly-workbook operating statistics and indicators derived
// from them with documented formulas. It never derives a fair value, target
// price, upside or recommendation (docs/market-infrastructure-model.md).
//
// Monetary values are in BRL (reais, not thousands). Share counts are in
// shares. Ratios are fractions (0.66 = 66%). Statement accounts keep the CVM
// sign (expenses and cash outflows negative). Workbook KPIs keep B3's
// published units, stated next to every value.
//
// No @/ imports — also used by tsx scripts.

export const MARKET_INFRASTRUCTURE_CACHE_SCHEMA_VERSION = 1;

export type EnrichmentStatus = "ok" | "preserved" | "failed";

export interface StatementAccountRef {
  statement: string;
  code: string;
  description: string;
  /** BRL, CVM sign. */
  value: number;
}

// ─── Issuer ───────────────────────────────────────────────────────────────────

export interface MarketInfrastructureIssuer {
  ticker: string;
  cvmCode: string;
  cnpj: string;
  /** DENOM_SOCIAL in the CVM registry at precompute time. */
  legalName: string;
  tradingName: string;
  registration: string;
  /** Consolidated statements are authoritative for the market-infrastructure model. */
  statementBasis: "consolidated";
}

export interface MarketInfrastructureShareClass {
  ticker: string;
  kind: "ON";
  isin: string;
}

/** One composicao_capital entry (B3 files share counts in units). */
export interface ShareCountSnapshot {
  referenceDate: string;
  document: "DFP" | "ITR";
  filingVersion: number;
  issuedShares: number;
  treasuryShares: number;
  /** issuedShares − treasuryShares. */
  outstandingShares: number;
}

// ─── Consolidated CVM statements ──────────────────────────────────────────────

/** Single-quarter flows filed in the same ITR (Q1: = YTD). Null for DFP. */
export interface QuarterFlows {
  periodStart: string;
  grossRevenue: number | null;
  netRevenue: number | null;
  operatingExpenses: number | null;
}

export interface MarketInfrastructureStatement {
  /** statementReferenceDate (balance-sheet date). */
  periodEnd: string;
  document: "DFP" | "ITR";
  fiscalYear: number;
  quarter: 1 | 2 | 3 | 4;
  /** Flow accounts are cumulative from this date (Jan 1 of fiscalYear). */
  flowPeriodStart: string;
  /** DT_RECEB of the filing version used. */
  filingDate: string | null;
  filingVersion: number;
  cvmDocumentId: string | null;
  basis: "consolidated";

  // Income statement, cumulative (YTD) from flowPeriodStart.
  /** Σ revenue lines: 3.01 with any revenue-tax sub-lines filed inside it added back. */
  grossRevenueYtd: number | null;
  /** 3.02 (PIS/Cofins, ISS) plus revenue-tax sub-lines filed inside 3.01. Not a cost of goods sold. */
  revenueDeductionsYtd: number | null;
  /** 3.03 "Resultado Bruto" — for B3 this is net revenue, not a gross profit. */
  netRevenueYtd: number | null;
  /** 3.04.02 Despesas Gerais e Administrativas — every B3 operating expense. */
  operatingExpensesYtd: number | null;
  /** 3.04.03 + 3.04.04 + 3.04.05: impairment, other operating income/expenses. */
  impairmentLossesYtd: number | null;
  otherOperatingIncomeYtd: number | null;
  otherOperatingExpensesYtd: number | null;
  equityMethodIncomeYtd: number | null;
  /** 3.05 — stored; never the headline operating margin. */
  ebitYtd: number | null;
  financialResultYtd: number | null;
  pretaxIncomeYtd: number | null;
  incomeTaxYtd: number | null;
  netIncomeConsolidatedYtd: number | null;
  /** 3.11.01 Atribuído a Sócios da Empresa Controladora. */
  netIncomeAttributableYtd: number | null;

  quarterFlows: QuarterFlows | null;

  // Cash-flow statement (indirect), cumulative.
  depreciationAmortizationYtd: number | null;
  /** 6.01 as filed. Raw provenance only: includes investment and collateral flows; never an indicator. */
  operatingCashFlowReportedYtd: number | null;
  capexPropertyYtd: number | null;
  capexSoftwareYtd: number | null;
  /** "Pagamento de Proventos" (dividends + interest on equity paid). */
  distributionsPaidYtd: number | null;
  /** "Recompra de Ações". */
  buybacksYtd: number | null;
  /** 6.05.02 Saldo Final de Caixa e Equivalentes. */
  cashFlowStatementClosingCash: number | null;

  // Balance sheet at periodEnd.
  /** 1.01.01 as filed — includes third-party balances; never "B3 cash". */
  balanceSheetCashReported: number | null;
  /** 1.01.02 + 1.02.01.01 + 1.02.01.02 + 1.02.01.03 (includes derivative assets). */
  financialInvestments: number | null;
  financialInvestmentAccounts: StatementAccountRef[];
  /** 2.01.04 + 2.02.01. */
  grossDebt: number | null;
  /** 2.03 Patrimônio Líquido Consolidado (includes 2.03.09 non-controlling interests). */
  equity: number | null;
  nonControllingInterests: number | null;
  /** 2.01.05.02.04 Garantia Recebidas em Operações (third-party cash collateral). */
  collateralReceived: number | null;
  /** 2.01.05.02.05 Proventos e Direitos sobre Títulos em Custódia (third-party). */
  custodyPayments: number | null;
  /** 2.01.05.02.08 + 2.02.02.02.04 (absent non-current line proven zero by its parent sum). */
  derivativeLiabilities: number | null;

  /** Every account read above, for provenance. */
  accounts: StatementAccountRef[];
  /** Fields left null because the source failed a check, plus layout notes. */
  issues: string[];
}

// ─── Revenue segments ─────────────────────────────────────────────────────────

export type RevenueSegmentId =
  | "mercados"
  | "solucoes_analiticas_de_dados"
  | "solucoes_para_mercado_de_capitais"
  | "tecnologia_e_plataformas"
  | "outras_receitas";

/** Approved segment periods only — never a TTM. */
export type SegmentPeriodKind = "quarter" | "ytd" | "fy";

export interface RevenueSegmentLine {
  segmentId: RevenueSegmentId;
  code: string;
  /** DS_CONTA as filed. */
  label: string;
  /** BRL, gross revenue. */
  value: number;
  /** value / Σ segment lines. */
  share: number;
}

export interface RevenueSegmentSnapshot {
  periodStart: string;
  periodEnd: string;
  periodKind: SegmentPeriodKind;
  /** The single filing every line comes from. */
  source: {
    document: "DFP" | "ITR";
    filingReferenceDate: string;
    filingVersion: number;
    /** True when the period is a comparative restated inside a later filing. */
    comparative: boolean;
  };
  taxonomy: "current_2025";
  lines: RevenueSegmentLine[];
  /** Σ lines vs 3.01 of the same filing and period. */
  reconciliation: { sumOfLines: number; grossRevenue: number; difference: number; tolerance: number; passed: boolean };
}

// ─── Financial position ───────────────────────────────────────────────────────

export interface ThirdPartyBalances {
  referenceDate: string;
  /** 2.01.05.02.04 — cash collateral deposited by participants (liability). */
  collateralReceived: number | null;
  /** 2.01.05.02.05 — proceeds and rights on securities in custody (liability). */
  custodyPayments: number | null;
  /** No other third-party balance is identifiable in structured CVM data. */
  otherValidatedThirdPartyBalances: { label: string; value: number }[];
}

export interface FinancialPosition {
  referenceDate: string;
  /** 1.01.01 as filed (includes third-party balances). */
  balanceSheetCashReported: number | null;
  /**
   * Secondary/provenance only: 6.05.02 closing cash of the cash-flow statement,
   * when its checks pass. Never used in the managed position, leverage or any
   * liquidity measure. Reading it as "B3 own cash" is validated only for the
   * periods in ownCashInterpretationValidatedFor.
   */
  cashAndCashEquivalentsPerCashFlow: number | null;
  cashFlowCashMethod: string;
  /** Periods where B3's notes state the cash-flow cash excludes third-party resources. */
  ownCashInterpretationValidatedFor: string[];
  /** 1.01.01 − cashAndCashEquivalentsPerCashFlow: balances not classified by structured data. */
  balanceSheetCashNotInCashFlowCash: number | null;
  financialInvestments: number | null;
  grossDebt: number | null;
  derivativeLiabilities: number | null;
  thirdPartyBalances: ThirdPartyBalances;
  /** B3 capital-management concept ("Posição financeira líquida gerida"). */
  managedNetFinancialPosition: number | null;
  managedNetFinancialPositionMethod: string;
  components: { label: string; accounts: string[]; value: number | null; sign: 1 | -1 }[];
  caveats: string[];
  issues: string[];
}

// ─── Operating KPIs (official quarterly workbook) ─────────────────────────────

export interface WorkbookValue {
  value: number | null;
  /** B3's published unit. */
  unit: string;
  /** Sheet / row labels the value was read from. */
  source: string;
}

export interface WorkbookSource {
  title: string;
  fileName: string;
  url: string;
  mzDocumentId: string;
  /** MZ file_published_date (file_date is unreliable). */
  publishedDate: string | null;
  fileQuarter: number;
  fileYear: number;
  sha256: string;
  byteLength: number;
}

export interface ExpenseCompositionLine {
  label: string;
  labelEn: string;
  /** BRL, quarter, CVM-like sign (negative). */
  value: number;
}

export interface OperatingMetricsSnapshot {
  /** Quarter-end date of the workbook's latest column (workbookQuarter). */
  quarterEnd: string;
  quarterLabel: string;
  source: WorkbookSource;
  derivatives: { adv: WorkbookValue; rpc: WorkbookValue };
  cashEquities: { adtv: WorkbookValue; feeMarginBps: WorkbookValue };
  fixedIncomeCredit: {
    bankingInstrumentsAverageStock: WorkbookValue;
    corporateBondsAverageStock: WorkbookValue;
    otherAverageStock: WorkbookValue;
  };
  /** Optional: each one null when missing — never zero. */
  secondary: {
    otcDerivativesAverageStock: WorkbookValue;
    securitiesLendingAverageOpenInterest: WorkbookValue;
    tesouroDiretoAverageStock: WorkbookValue;
  };
  /** Secondary — the workbook expense breakdown for the quarter, when it adds up. */
  expenseComposition: { lines: ExpenseCompositionLine[]; total: number; reconciled: boolean } | null;
  /** Workbook total revenue vs CVM consolidated 3.01 of the same quarter. */
  revenueCrossCheck: {
    workbookTotalRevenue: number;
    cvmGrossRevenueQuarter: number;
    cvmComposition: string[];
    difference: number;
    tolerance: number;
    passed: boolean;
  };
  /** Official operating result / EBITDA vs this model's reproduction (diagnostic). */
  officialReconciliation: {
    label: string;
    workbook: number | null;
    reproduced: number | null;
    difference: number | null;
    tolerance: number;
    passed: boolean | null;
  }[];
  notes: string[];
}

// ─── Capital allocation ───────────────────────────────────────────────────────

export interface CapitalAllocation {
  /** Period ends combined for the TTM flows (capitalAllocationReferencePeriod). */
  referencePeriod: string[];
  distributionsPaidTtm: number | null;
  buybacksTtm: number | null;
  latestShareCount: ShareCountSnapshot | null;
  comparableShareCount: ShareCountSnapshot | null;
  issues: string[];
}

// ─── Indicators ───────────────────────────────────────────────────────────────

export type IndicatorUnit =
  | "BRL"
  | "ratio"
  | "multiple"
  | "shares"
  | "segment_mix"
  | "workbook_unit";

export interface MarketInfrastructureIndicator {
  value: number | null;
  unit: IndicatorUnit;
  /** Published unit for workbook KPIs (e.g. "R$ milhões/dia"). */
  publishedUnit?: string;
  /** Statement/workbook periods combined, e.g. ["2026-06-30", "+2025-12-31", "-2025-06-30"]. */
  composition: string[];
  source: string;
  reason?: string;
  note?: string;
  /** Segment-mix lines (unit "segment_mix" only). */
  lines?: RevenueSegmentLine[];
  /** Structured parts of a composite value (fixed-income stocks, share counts). */
  parts?: Record<string, number | null>;
}

export const CORE_INDICATOR_KEYS = [
  "netRevenueTtm",
  "netRevenueYoyGrowth",
  "grossRevenueCurrentPeriod",
  "revenueSegmentMix",
  "derivativesAdv",
  "derivativesRpc",
  "cashEquitiesAdtv",
  "cashEquitiesFeeMarginBps",
  // B3 publishes these three stocks separately and no official aggregate: no sum is exposed.
  "fixedIncomeBankingInstrumentsAverageStock",
  "fixedIncomeCorporateBondsAverageStock",
  "fixedIncomeOtherAverageStock",
  "operatingMargin",
  "ebitdaTtm",
  "ebitdaMargin",
  "netIncomeAttributableTtm",
  "grossDebt",
  "managedNetFinancialPosition",
  "grossDebtToEbitdaTtm",
  "shareholderDistributionsTtm",
  "buybacksTtm",
  "outstandingSharesChange",
] as const;

export const SECONDARY_INDICATOR_KEYS = [
  "expenseComposition",
  "capexTtm",
  "returnOnEquity",
  "effectiveTaxRateTtm",
  "otcDerivativesAverageStock",
  "securitiesLendingAverageOpenInterest",
  "tesouroDiretoAverageStock",
] as const;

export type CoreIndicatorKey = (typeof CORE_INDICATOR_KEYS)[number];
export type SecondaryIndicatorKey = (typeof SECONDARY_INDICATOR_KEYS)[number];

export interface MarketInfrastructureIndicators {
  core: Record<CoreIndicatorKey, MarketInfrastructureIndicator>;
  secondary: Record<SecondaryIndicatorKey, MarketInfrastructureIndicator>;
  /** Descriptive flag: non-recurring operating lines inside the TTM net income. */
  oneOffFlag: { flagged: boolean; amountTtm: number | null; lines: string[] };
}

// ─── Cache ────────────────────────────────────────────────────────────────────

export interface MarketInfrastructureReferenceDates {
  statementReferenceDate: string | null;
  filingDate: string | null;
  filingVersion: number | null;
  segmentReferencePeriod: { periodStart: string; periodEnd: string; periodKind: SegmentPeriodKind } | null;
  workbookQuarter: string | null;
  workbookPublicationDate: string | null;
  financialPositionReferenceDate: string | null;
  shareCountReferenceDate: string | null;
  capitalAllocationReferencePeriod: string[];
}

export interface MarketInfrastructureEnrichment {
  statements: EnrichmentStatus;
  segments: EnrichmentStatus;
  operatingMetrics: EnrichmentStatus;
  issues: string[];
}

export interface MarketInfrastructureCache {
  schemaVersion: typeof MARKET_INFRASTRUCTURE_CACHE_SCHEMA_VERSION;
  ticker: string;
  source: "market_infrastructure_analysis";
  issuer: MarketInfrastructureIssuer;
  shareClass: MarketInfrastructureShareClass;
  shareCounts: ShareCountSnapshot[];
  statements: MarketInfrastructureStatement[];
  latestStatement: { periodEnd: string; document: "DFP" | "ITR"; filingDate: string | null; filingVersion: number } | null;
  revenueSegments: RevenueSegmentSnapshot[];
  operatingMetrics: OperatingMetricsSnapshot | null;
  financialPosition: FinancialPosition | null;
  capitalAllocation: CapitalAllocation;
  indicators: MarketInfrastructureIndicators;
  referenceDates: MarketInfrastructureReferenceDates;
  sources: { statements: string[]; workbook: string | null; registry: string };
  enrichment: MarketInfrastructureEnrichment;
  methodologyNotes: string[];
  warnings: string[];
  updatedAt: string;
}
