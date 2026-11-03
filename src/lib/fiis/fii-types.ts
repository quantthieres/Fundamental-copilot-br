export type FiiFinancialRecord = {
  ticker: string;
  // First day of the reference month. A month can come from the CVM informe
  // (NAV fields set), from a Fundos.Net notice only (NAV fields null — the
  // informe for that month is not out yet), or both.
  referenceDate: string;

  netAssetValue: number | null;
  quotaCount: number | null;
  netAssetValuePerShare: number | null;

  // Cash distribution (rendimento) per share declared in an active B3
  // Fundos.Net structured notice for this reference month; an explicit 0 is
  // kept. null when no valid notice exists. Never an estimate, never
  // amortization. See docs/fii-distribution-source.md.
  monthlyDistributionPerShare?: number | null;
  distributionSource?: FiiDistributionSource | null;
  // Fundos.Net provenance, set when distributionSource is "fnet_structured".
  distributionBaseDate?: string | null;
  distributionPaymentDate?: string | null;
  fnetDocumentIds?: number[];
  // Capital returned (amortização) per share; kept apart from distributions.
  monthlyAmortizationPerShare?: number | null;
  // Diagnostic only: Percentual_Dividend_Yield_Mes × Valor_Patrimonial_Cotas
  // from the CVM informe. Not a paid amount — never shown or counted.
  cvmDerivedDistributionEstimate?: number | null;

  // fii_fnet_only: month known only from a Fundos.Net notice (no NAV yet).
  source: "fii_cvm_cache" | "fii_fnet_only" | "fii_unavailable";
};

export type FiiDistributionSource = "fnet_structured";

// Outcome of the Fundos.Net enrichment for one fund (precompute time).
export type FiiDistributionEnrichment = {
  source: "fnet_structured";
  // ok: notices found and parsed · no_events: none for this fund ·
  // preserved: Fundos.Net unavailable; NAV refreshed from CVM and the
  //   distributions of the previous committed cache carried over unchanged ·
  // failed: Fundos.Net unavailable and no earlier Fundos.Net data, so every
  //   distribution is null (never estimated).
  status: "ok" | "no_events" | "preserved" | "failed";
  isin: string | null;
  noticesListed: number;
  // Active notices with at least one event used in a cached month.
  noticesUsed: number;
  issues: string[];
};

export type FiiIndicators = {
  netAssetValuePerShare: number | null;
  lastDistributionPerShare: number | null;
  twelveMonthDistributionPerShare: number | null;
  dividendYield12m: number | null;
  priceToBookValuePerShare: number | null;
  // Months with a distribution value (0 included) among the 12 consecutive
  // calendar months ending at distributionWindowEnd. Drives readiness and the
  // panel's coverage warnings.
  distributionCoverageMonths: number;
  // Reference month (yyyy-mm-01) of the NAV used above; may be older than
  // the latest distribution.
  navReferenceDate: string | null;
  // Latest reference month with a distribution value.
  distributionReferenceDate: string | null;
  // Last month of the 12-month distribution window.
  distributionWindowEnd: string | null;
  // Latest NAV month minus latest distribution month (negative = distribution
  // newer); fresh when ≤ FII_MAX_DISTRIBUTION_LAG_MONTHS. Readiness needs both
  // 12/12 coverage and freshness.
  distributionLagMonths: number | null;
  distributionFresh: boolean;
};

export type FiiAnalysisResponse = {
  ticker: string;
  source: "fii_analysis";
  sourceDetail: "fii_cvm_cache" | "fii_unavailable";
  available: boolean;
  fund?: {
    ticker: string;
    name: string;
    cnpj?: string;
  };
  records: FiiFinancialRecord[];
  indicators: FiiIndicators | null;
  distributionEnrichment?: FiiDistributionEnrichment;
  updatedAt: string;
  warnings: string[];
};
