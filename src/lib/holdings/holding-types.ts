// Holding model — cache schema shared by every listed holding (Itaúsa, Bradespar).
//
// Descriptive only: the cache stores what the issuer publishes (portfolio,
// market value, discount) plus parent-only CVM statements. It never derives a
// fair value, target price, upside or recommendation.
//
// Monetary values are in BRL (reais, not thousands or billions). Share counts
// are in shares. Ratios and percentages are fractions (0.375 = 37.5%).
// Expense accounts keep the CVM sign (negative).
//
// No @/ imports — also used by tsx scripts.

export const HOLDING_CACHE_SCHEMA_VERSION = 1;

// ─── Issuer and share classes ─────────────────────────────────────────────────

export type ShareClassKind = "ON" | "PN";

export interface HoldingShareClass {
  ticker: string;
  kind: ShareClassKind;
  isin: string;
  /** CVM composicao_capital, converted from thousands of shares. */
  issuedShares: number | null;
  treasuryShares: number | null;
  /** issuedShares − treasuryShares. */
  outstandingShares: number | null;
  /** Balance-sheet date of the share count (shareCountReferenceDate). */
  referenceDate: string | null;
  source: "cvm_itr_composicao_capital" | "cvm_dfp_composicao_capital" | null;
}

export interface HoldingIssuer {
  canonicalTicker: string;
  cvmCode: string;
  cnpj: string;
  /** DENOM_SOCIAL in the CVM registry at precompute time. */
  legalName: string;
  /** Parent-only (individual) statements are authoritative for holding figures. */
  statementBasis: "individual";
}

// ─── Parent-only CVM statements ───────────────────────────────────────────────

export interface StatementAccountRef {
  code: string;
  description: string;
  /** BRL, CVM sign. */
  value: number;
}

/**
 * How CVM account 1.01.02 (Aplicações Financeiras) is treated:
 *   portfolio_investment — an investee stake held at fair value (Itaúsa: NTS);
 *                          part of the portfolio, never liquidity.
 *   unverified           — not classified for this issuer; kept out of cash.
 * Holding cash is always CVM 1.01.01 only.
 */
export type ShortTermInvestmentClassification = "portfolio_investment" | "unverified";

export interface ShortTermInvestments {
  value: number;
  account: StatementAccountRef;
  classification: ShortTermInvestmentClassification;
  includedInCash: false;
  note: string;
}

export interface HoldingStatement {
  /** financialStatementReferenceDate (balance-sheet date). */
  periodEnd: string;
  document: "DFP" | "ITR";
  fiscalYear: number;
  /** 1–3 for ITR, 4 for DFP. */
  quarter: 1 | 2 | 3 | 4;
  /** Flow accounts are cumulative from this date (Jan 1 of fiscalYear). */
  flowPeriodStart: string;
  /** DT_RECEB of the filing version used. */
  filingDate: string | null;
  filingVersion: number;
  cvmDocumentId: string | null;
  basis: "individual";

  cash: number | null;
  shortTermInvestments: ShortTermInvestments | null;
  /** CVM 1.02.02 Investimentos (equity-accounted stakes and other investments). */
  equityStakes: number | null;
  /** CVM 2.01.04 + 2.02.01 (loans, financing and debentures). */
  grossDebt: number | null;
  /** Statement net debt at periodEnd: grossDebt − cash (1.01.01); negative =
   *  net cash. Never replaced by an issuer-published net-cash figure. */
  netDebt: number | null;
  equity: number | null;

  generalAdministrativeExpensesYtd: number | null;
  equityMethodIncomeYtd: number | null;
  financialExpensesYtd: number | null;
  netIncomeYtd: number | null;
  /** Issuer-specific, description-verified cash-flow account. */
  dividendsReceivedYtd: number | null;
  /** Issuer-specific; null when the issuer reports no such line. */
  interestPaidYtd: number | null;

  /** Every account used above, for provenance. */
  accounts: StatementAccountRef[];
  /** Fields left null because the source failed a check. */
  issues: string[];
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

export type PortfolioValueBasis =
  | "market_price"
  | "transaction_price"
  | "book_value"
  | "booked_fair_value"
  | "mixed_transaction_and_book"
  | "other_assets_liabilities"
  | "net_cash"
  | "unclassified";

export type PortfolioComponentKind = "investment" | "other_assets_liabilities" | "net_cash";

export interface MixedBasisPart {
  basis: "transaction_price" | "book_value";
  value: number;
  referenceDate: string | null;
  description: string;
}

export interface HoldingPortfolioComponent {
  name: string;
  kind: PortfolioComponentKind;
  /** B3 ticker of the investee's priced class, when the source names one. */
  ticker: string | null;
  listed: boolean;
  /** As published by the issuer (fraction). */
  ownershipPct: number | null;
  ownershipReferenceDate: string | null;
  value: number;
  valueBasis: PortfolioValueBasis;
  valueReferenceDate: string | null;
  pricePerShare: number | null;
  /** Investee shares held by the holding, when published. */
  sharesHeld: number | null;
  /** Investee market value used by the issuer, when published. */
  investeeMarketValue: number | null;
  /** Investee total shares used by the issuer, when published. */
  investeeTotalShares: number | null;
  parts: MixedBasisPart[] | null;
  /** Source footnote text, verbatim. */
  footnote: string | null;
  source: string;
}

export type OfficialMarketValueMethod =
  /** Itaúsa: price of the most liquid class × all classes' shares ex-treasury. */
  | "most_liquid_class_price_times_total_ex_treasury_shares"
  /** Bradespar: Σ(class price × class shares ex-treasury). */
  | "class_price_times_class_shares_sum";

export interface OfficialMarketValueClass {
  ticker: string;
  price: number;
  /** Shares the issuer multiplied by this price. */
  shares: number;
  sharesScope: "all_classes_ex_treasury" | "class_ex_treasury";
  value: number | null;
}

export interface OfficialMarketValue {
  value: number;
  method: OfficialMarketValueMethod;
  priceReferenceDate: string | null;
  classes: OfficialMarketValueClass[];
}

export interface OfficialDiscount {
  /** officialMarketValue / officialPortfolioValue − 1 (negative = discount). */
  value: number;
  /** Verbatim published figure, e.g. "-18,2%" or "34,1%". */
  published: string;
  formula: "officialMarketValue / officialPortfolioValue - 1";
  signConvention: "published_signed" | "published_as_positive_discount_magnitude";
}

export interface ValidationCheck {
  name: string;
  published: number;
  computed: number;
  tolerance: number;
  passed: boolean;
}

export interface PortfolioValidation {
  status: "passed" | "failed";
  checks: ValidationCheck[];
}

export type PortfolioSourceKind = "itausa_portfolio_page" | "bradespar_boletim_quinzenal";

export interface HoldingPortfolioSource {
  kind: PortfolioSourceKind;
  url: string;
  title: string;
  /** Unit of the published figures before conversion to BRL. */
  publishedUnit: "BRL_millions" | "BRL_thousands";
  publicationDateSource: string;
}

/**
 * Net cash as printed in the issuer's portfolio publication (Bradespar
 * bulletin line "Caixa Líquido (B)"), at its own reference date. It is an
 * input to the official NAV only — never the statement cash or net debt, which
 * come from the CVM filing at the statement date.
 */
export interface PublishedNetCash {
  value: number;
  referenceDate: string;
  source: string;
  usage: "input_to_official_portfolio_value";
}

export interface HoldingPortfolio {
  source: HoldingPortfolioSource;
  /** Market-price date of the snapshot. */
  portfolioReferenceDate: string;
  portfolioPublicationDate: string | null;
  components: HoldingPortfolioComponent[];
  /** Null when the publication has no separate net-cash line (Itaúsa). */
  publishedNetCash: PublishedNetCash | null;
  officialPortfolioValue: number;
  officialMarketValue: OfficialMarketValue;
  officialDiscount: OfficialDiscount;
  /** Σ(class price × class shares ex-treasury) at the snapshot date, when the
   *  official source gives every class price. Diagnostic; never replaces
   *  officialMarketValue. */
  standardizedClassWeightedMarketCap: number | null;
  standardizedClassWeightedMarketCapNote: string;
  validation: PortfolioValidation;
  /** Methodology caveats carried with the snapshot (e.g. Bradespar 3.84%). */
  diagnostics: string[];
}

// ─── Freshness ────────────────────────────────────────────────────────────────

export interface PortfolioFreshness {
  status: "fresh" | "stale" | "unknown";
  portfolioReferenceDate: string | null;
  statementReferenceDate: string | null;
  /** Fiscal quarters the portfolio lags the latest statement (≤ 0 = newer). */
  quarterLag: number | null;
  rule: "portfolio_reference_period_at_most_one_fiscal_quarter_older_than_latest_statement";
}

// ─── Indicators ───────────────────────────────────────────────────────────────

export interface HoldingIndicator {
  value: number | null;
  unit: "BRL" | "ratio";
  /** Reference dates of every input. */
  asOf: string[];
  note?: string;
}

export interface HoldingIndicators {
  core: {
    officialPortfolioValue: HoldingIndicator;
    listedInvestmentValue: HoldingIndicator;
    unlistedInvestmentValue: HoldingIndicator;
    /** Largest positive investee value / Σ positive investee values. Excludes
     *  net cash and other assets/liabilities; NOT a share of the net SOTP. */
    largestInvesteeConcentration: HoldingIndicator & { investee: string | null };
    /** Statement figures (CVM, parent-only) at the statement date. */
    holdingCash: HoldingIndicator;
    grossDebt: HoldingIndicator;
    netDebt: HoldingIndicator;
    dividendsReceivedTtm: HoldingIndicator;
    generalAdministrativeExpensesTtm: HoldingIndicator;
    equityMethodIncomeTtm: HoldingIndicator;
    netDebtToOfficialPortfolioValue: HoldingIndicator;
    officialMarketValue: HoldingIndicator;
    officialDiscount: HoldingIndicator;
  };
  secondary: {
    equity: HoldingIndicator;
    netIncomeTtm: HoldingIndicator;
    financialExpensesTtm: HoldingIndicator;
    dividendsReceivedToFinancialExpenses: HoldingIndicator;
    grossDebtToDividendsReceived: HoldingIndicator;
    generalAdministrativeExpensesToDividendsReceived: HoldingIndicator;
    standardizedClassWeightedMarketCap: HoldingIndicator;
  };
}

// ─── Cache ────────────────────────────────────────────────────────────────────

export type EnrichmentStatus = "ok" | "preserved" | "failed";

export interface HoldingEnrichment {
  statements: EnrichmentStatus;
  portfolio: EnrichmentStatus;
  issues: string[];
}

export interface HoldingReferenceDates {
  financialStatementReferenceDate: string | null;
  filingDate: string | null;
  portfolioReferenceDate: string | null;
  portfolioPublicationDate: string | null;
  shareCountReferenceDate: string | null;
  /** Ticker → date of the price used in the official market value. */
  marketPriceReferenceDates: Record<string, string | null>;
}

export interface HoldingCache {
  schemaVersion: typeof HOLDING_CACHE_SCHEMA_VERSION;
  ticker: string;
  source: "holding_analysis";
  issuer: HoldingIssuer;
  shareClasses: HoldingShareClass[];
  /** Parent-only statements, ascending by periodEnd. */
  statements: HoldingStatement[];
  latestStatement: {
    periodEnd: string;
    document: "DFP" | "ITR";
    filingDate: string | null;
    filingVersion: number;
  } | null;
  portfolio: HoldingPortfolio | null;
  portfolioFreshness: PortfolioFreshness;
  indicators: HoldingIndicators;
  referenceDates: HoldingReferenceDates;
  provenance: {
    statements: string[];
    portfolio: string | null;
  };
  enrichment: HoldingEnrichment;
  warnings: string[];
  updatedAt: string;
}
