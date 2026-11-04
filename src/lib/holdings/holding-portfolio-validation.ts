// Shared parsing and validation helpers for official holding portfolios.
//
// Publication rounding is handled explicitly: every check states the largest
// difference its rounded inputs can produce, and a snapshot that misses any
// check is rejected (the previous validated snapshot is then preserved).
//
// No @/ imports — also used by tsx scripts.

import type { HoldingPortfolio, PortfolioFreshness, ValidationCheck } from "./holding-types";

/** "10.131.252" → 10131252; "62,02" → 62.02; "-1.241" → -1241; "(1.241)" → -1241. */
export function parseBrNumber(text: string): number | null {
  let s = text.trim().replace(/ /g, "");
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (s.startsWith("-") || s.startsWith("−")) { negative = true; s = s.slice(1); }
  if (!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(s)) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return negative ? -n : n;
}

/** "37,5%" → 0.375; "-18,2%" → -0.182. */
export function parseBrPercent(text: string): number | null {
  const m = /^(.*)%$/.exec(text.trim());
  if (!m) return null;
  const n = parseBrNumber(m[1]);
  return n === null ? null : round(n / 100, 10);
}

/** Decimal places of a published Brazilian number ("62,02" → 2). */
export function decimalsOf(text: string): number {
  const m = /,(\d+)/.exec(text);
  return m ? m[1].length : 0;
}

/** "30.09.2026" or "30/09/2026" → "2026-09-30"; two-digit years are 20xx. */
export function parseBrDate(text: string): string | null {
  const m = /^(\d{2})[./](\d{2})[./](\d{2}|\d{4})$/.exec(text.trim());
  if (!m) return null;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  const iso = `${year}-${m[2]}-${m[1]}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

export function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function check(name: string, published: number, computed: number, tolerance: number): ValidationCheck {
  return {
    name,
    published,
    computed: round(computed, 6),
    tolerance: round(tolerance, 6),
    passed: Math.abs(published - computed) <= tolerance + 1e-9,
  };
}

/** Largest error of a×b when a and b are each rounded to half a unit of their last digit. */
export function productTolerance(a: number, aHalfUnit: number, b: number, bHalfUnit: number, resultHalfUnit: number): number {
  return Math.abs(a) * bHalfUnit + Math.abs(b) * aHalfUnit + aHalfUnit * bHalfUnit + resultHalfUnit;
}

// ─── Freshness ────────────────────────────────────────────────────────────────

function quarterIndex(iso: string): number {
  return Number(iso.slice(0, 4)) * 4 + Math.floor((Number(iso.slice(5, 7)) - 1) / 3);
}

/**
 * A portfolio is fresh when its reference period is at most one fiscal
 * quarter older than the latest statement period. Source periods only —
 * never the current date.
 */
export function portfolioFreshness(
  portfolio: Pick<HoldingPortfolio, "portfolioReferenceDate"> | null,
  latestStatementPeriodEnd: string | null,
): PortfolioFreshness {
  const rule = "portfolio_reference_period_at_most_one_fiscal_quarter_older_than_latest_statement" as const;
  const portfolioReferenceDate = portfolio?.portfolioReferenceDate ?? null;
  if (!portfolioReferenceDate || !latestStatementPeriodEnd) {
    return { status: "unknown", portfolioReferenceDate, statementReferenceDate: latestStatementPeriodEnd, quarterLag: null, rule };
  }
  const quarterLag = quarterIndex(latestStatementPeriodEnd) - quarterIndex(portfolioReferenceDate);
  return {
    status: quarterLag <= 1 ? "fresh" : "stale",
    portfolioReferenceDate,
    statementReferenceDate: latestStatementPeriodEnd,
    quarterLag,
    rule,
  };
}

export type PortfolioParseResult =
  | { ok: true; portfolio: HoldingPortfolio; warnings: string[] }
  | { ok: false; error: string };
