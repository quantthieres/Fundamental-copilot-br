import type { NormalizedFinancials } from "@/lib/cvm/types";
import type { MarketDataQuote } from "@/lib/market-data/types";

// ─── Primitives ───────────────────────────────────────────────────────────────

export function safeDivide(numerator: number | undefined, denominator: number | undefined): number | null {
  if (numerator === undefined || denominator === undefined || denominator === 0) return null;
  return numerator / denominator;
}

export function calculateGrowth(current: number | undefined, previous: number | undefined): number | null {
  if (current === undefined || previous === undefined || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

export function calculateCagr(start: number | undefined, end: number | undefined, years: number): number | null {
  if (start === undefined || end === undefined || start <= 0 || years <= 0) return null;
  return Math.pow(end / start, 1 / years) - 1;
}

// ─── Indicator groups ─────────────────────────────────────────────────────────

export interface GrowthIndicators {
  revenueGrowthYoY:  number | null;
  revenueCAGR:       number | null;
  ebitGrowthYoY:     number | null;
  netIncomeGrowthYoY: number | null;
  fcfGrowthYoY:      number | null;
}

export interface MarginIndicators {
  ebitMargin:    number | null;
  netMargin:     number | null;
  cfoMargin:     number | null;
  fcfMargin:     number | null;
}

export interface CashConversionIndicators {
  cfoOverNetIncome:  number | null;
  fcfOverNetIncome:  number | null;
  capexOverRevenue:  number | null;
  fcfYield:          number | null;
}

export interface DebtIndicators {
  netDebt:          number | null;
  netDebtOverEbit:  number | null;
  netDebtOverFcf:   number | null;
  cashOverTotalDebt: number | null;
}

export interface MarketIndicators {
  marketCapB:   number | null;
  enterpriseValueB: number | null;
  pe:           number | null;
  evOverEbit:   number | null;
  evOverRevenue: number | null;
}

export interface FundamentalIndicators {
  growth:       GrowthIndicators;
  margins:      MarginIndicators;
  cashConversion: CashConversionIndicators;
  debt:         DebtIndicators;
  market:       MarketIndicators;
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export function buildFundamentalIndicators(
  financials: NormalizedFinancials[],
  marketQuote: MarketDataQuote | null,
): FundamentalIndicators {
  const sorted = [...financials].sort((a, b) => b.fiscalYear - a.fiscalYear);
  const latest = sorted[0];
  const prev   = sorted[1];
  const oldest = sorted[sorted.length - 1];

  const years = sorted.length >= 2 ? sorted[0].fiscalYear - sorted[sorted.length - 1].fiscalYear : 0;

  // Market data
  const marketCapRaw = marketQuote?.marketCap;
  const price        = marketQuote?.price;
  const marketCapB   = marketCapRaw ? marketCapRaw / 1_000_000_000 : null;
  const netDebtVal   = latest?.netDebt ?? null;
  const evB          = marketCapB !== null && netDebtVal !== null ? marketCapB + netDebtVal : null;

  // Growth
  const revenueGrowthYoY   = calculateGrowth(latest?.revenue, prev?.revenue);
  const revenueCAGR        = sorted.length >= 3 ? calculateCagr(oldest?.revenue, latest?.revenue, years) : null;
  const ebitGrowthYoY      = calculateGrowth(latest?.ebit, prev?.ebit);
  const netIncomeGrowthYoY = calculateGrowth(latest?.netIncome, prev?.netIncome);
  const fcfGrowthYoY       = calculateGrowth(latest?.freeCashFlow, prev?.freeCashFlow);

  // Margins
  const ebitMargin = safeDivide(latest?.ebit, latest?.revenue);
  const netMargin  = safeDivide(latest?.netIncome, latest?.revenue);
  const cfoMargin  = safeDivide(latest?.operatingCashFlow, latest?.revenue);
  const fcfMargin  = safeDivide(latest?.freeCashFlow, latest?.revenue);

  // Cash conversion
  const cfoOverNetIncome = safeDivide(latest?.operatingCashFlow, latest?.netIncome);
  const fcfOverNetIncome = safeDivide(latest?.freeCashFlow, latest?.netIncome);
  const capexOverRevenue = safeDivide(latest?.capex, latest?.revenue);
  const fcfYield = (latest?.freeCashFlow !== undefined && marketCapB)
    ? safeDivide(latest.freeCashFlow, marketCapB)
    : null;

  // Debt
  const netDebt          = latest?.netDebt ?? null;
  const netDebtOverEbit  = safeDivide(latest?.netDebt, latest?.ebit);
  const netDebtOverFcf   = safeDivide(latest?.netDebt, latest?.freeCashFlow);
  const cashOverTotalDebt = safeDivide(latest?.cash, latest?.totalDebt);

  // Market multiples
  const pe           = (latest?.netIncome && latest.netIncome > 0 && marketCapB)
    ? safeDivide(marketCapB, latest.netIncome)
    : null;
  const evOverEbit   = (evB !== null && latest?.ebit && latest.ebit > 0)
    ? safeDivide(evB, latest.ebit)
    : null;
  const evOverRevenue = (evB !== null && latest?.revenue && latest.revenue > 0)
    ? safeDivide(evB, latest.revenue)
    : null;

  return {
    growth: { revenueGrowthYoY, revenueCAGR, ebitGrowthYoY, netIncomeGrowthYoY, fcfGrowthYoY },
    margins: { ebitMargin, netMargin, cfoMargin, fcfMargin },
    cashConversion: { cfoOverNetIncome, fcfOverNetIncome, capexOverRevenue, fcfYield },
    debt: { netDebt, netDebtOverEbit, netDebtOverFcf, cashOverTotalDebt },
    market: { marketCapB, enterpriseValueB: evB, pe, evOverEbit, evOverRevenue },
  };
}
