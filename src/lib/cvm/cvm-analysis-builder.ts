import type { NormalizedFinancials } from "./types";
import type { B3Asset } from "@/data/b3-universe";
import type { MarketDataQuote } from "@/lib/market-data/types";
import type {
  CompanyData,
  CompanyProfile,
  CompanyFundamentals,
  MetricItem,
} from "@/data/companies/types";
import { cvmFinancialsToDashboardFinancials } from "./transformers";

export interface AnalysisBuilderParams {
  b3Entry:       B3Asset;
  cvmFinancials: NormalizedFinancials[];
  marketQuote:   MarketDataQuote | null;
}

// ─── Eligibility ──────────────────────────────────────────────────────────────

/** True when this B3 entry can generate a CVM-driven analysis dashboard. */
export function isCvmAnalysisEligible(b3Entry: B3Asset): boolean {
  return (
    !b3Entry.hasMockData &&
    (b3Entry.coverageStatus === "cvm_financials" || b3Entry.coverageStatus === "cvm_analysis") &&
    b3Entry.hasCvmMapping &&
    (b3Entry.assetType === "stock" || b3Entry.assetType === "unit")
  );
}

/**
 * Returns null when the financials are usable for CVM analysis,
 * or a human-readable reason string when they are not.
 *
 * Exported so the audit script and tests can reuse it directly.
 */
export function cvmAnalysisEligibilityReason(financials: NormalizedFinancials[]): string | null {
  if (financials.length < 3) {
    return `apenas ${financials.length} ano(s) de dados disponíveis`;
  }

  const latest = [...financials].sort((a, b) => b.fiscalYear - a.fiscalYear)[0];

  if (latest.revenue === undefined) return "receita do último exercício ausente";
  if (latest.revenue <= 0)          return "receita do último exercício não positiva";

  const otherMetrics = [
    latest.ebit, latest.netIncome, latest.operatingCashFlow,
    latest.capex, latest.freeCashFlow, latest.netDebt,
  ];
  if (otherMetrics.every(v => v === undefined || v === 0)) {
    return "todos os indicadores do último exercício são zero";
  }

  const hasUsable =
    (latest.ebit              !== undefined && latest.ebit              !== 0) ||
    (latest.netIncome         !== undefined && latest.netIncome         !== 0) ||
    (latest.operatingCashFlow !== undefined && latest.operatingCashFlow !== 0) ||
    (latest.freeCashFlow      !== undefined && latest.freeCashFlow      !== 0);

  if (!hasUsable) return "nenhum indicador de resultado ou fluxo de caixa utilizável";

  return null;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmtB(v: number): string {
  return `R$ ${v.toFixed(1).replace(".", ",")}B`;
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Builds a CompanyData object from CVM DFP annual financials for the
 * fundamental analysis dashboard (no DCF, no valuation).
 *
 * Returns null when:
 * - fewer than 3 fiscal years of data
 * - latest revenue is missing or <= 0
 * - all key metrics are zero (malformed data)
 * - no usable income/CF metric exists
 *
 * Market-cap-dependent fields (marketCap, enterpriseValue, P/L, EV/EBIT) are
 * shown as "—" when the brapi quote does not include a marketCap value. This
 * allows the full dashboard to render as soon as CVM data arrives, without
 * waiting for (or being blocked by) a missing market cap.
 */
export function buildCompanyAnalysisDataFromCvm(
  params: AnalysisBuilderParams,
): CompanyData | null {
  const { b3Entry, cvmFinancials, marketQuote } = params;

  if (cvmAnalysisEligibilityReason(cvmFinancials) !== null) return null;

  const sorted = [...cvmFinancials].sort((a, b) => b.fiscalYear - a.fiscalYear);
  const latest = sorted[0];

  const price        = marketQuote?.price ?? 0;
  const marketCapRaw = marketQuote?.marketCap;
  const marketCapB   = marketCapRaw ? marketCapRaw / 1_000_000_000 : null;
  const sharesOut    = marketCapB !== null && price > 0 ? marketCapB / price : 0;
  const netDebt      = latest.netDebt ?? 0;
  const evB          = marketCapB !== null ? marketCapB + netDebt : null;

  // ── Company profile ──────────────────────────────────────────────────────────
  const company: CompanyProfile = {
    name:            b3Entry.companyName,
    ticker:          b3Entry.ticker,
    exchange:        "B3",
    sector:          b3Entry.sector,
    price,
    priceChange:     marketQuote?.change        ?? 0,
    priceChangePct:  marketQuote?.changePercent ?? 0,
    marketCap:       marketCapB !== null ? fmtB(marketCapB) : "—",
    enterpriseValue: evB        !== null ? fmtB(evB)        : "—",
    currency:        "BRL",
  };

  // ── Historical financials (sorted oldest→newest for chart) ────────────────
  const financials = cvmFinancialsToDashboardFinancials(cvmFinancials);

  // ── Metrics ───────────────────────────────────────────────────────────────
  const metrics: MetricItem[] = [];

  if (latest.revenue !== undefined) {
    metrics.push({ label: "Receita",        value: fmtB(latest.revenue),      trend: 0, suffix: "último ano" });
  }
  if (latest.ebit !== undefined && latest.revenue) {
    const margin = (latest.ebit / latest.revenue * 100).toFixed(1);
    metrics.push({ label: "Margem EBIT",    value: `${margin}%`,              trend: 0, suffix: "último ano" });
  }
  if (latest.freeCashFlow !== undefined) {
    metrics.push({ label: "FCL",            value: fmtB(latest.freeCashFlow), trend: 0, suffix: "último ano" });
  }
  if (latest.netDebt !== undefined) {
    metrics.push({ label: "Dívida Líquida", value: fmtB(latest.netDebt),      trend: 0, suffix: "último ano" });
  }
  // Market-cap-dependent metrics: only included when marketCap is available.
  if (marketCapB !== null) {
    metrics.push({ label: "Valor de Mercado", value: fmtB(marketCapB),        trend: 0, suffix: "brapi"      });
    if (latest.netIncome && latest.netIncome > 0) {
      const pe = (marketCapB / latest.netIncome).toFixed(1);
      metrics.push({ label: "P/L",            value: `${pe}x`,                trend: 0, suffix: "estimado"   });
    }
    if (evB !== null && latest.ebit && latest.ebit > 0) {
      const evEbit = (evB / latest.ebit).toFixed(1);
      metrics.push({ label: "EV/EBIT",        value: `${evEbit}x`,            trend: 0, suffix: "estimado"   });
    }
  }

  // ── Fundamentals ──────────────────────────────────────────────────────────
  const fundamentals: CompanyFundamentals = {
    currentRevenue:    latest.revenue!,
    sharesOutstanding: sharesOut,
    netDebt,
  };

  return {
    company,
    metrics,
    financials,
    fundamentals,
    multiples: [],
    news:      [],
  };
}
