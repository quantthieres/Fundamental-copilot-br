/**
 * Quarterly cache audit: shows quarterly vs. annual DFP values for a ticker/metric.
 *
 * Usage:
 *   npm run cvm:audit:quarterly -- --ticker KLBN11 --metric revenue
 *   npm run cvm:audit:quarterly -- --ticker WEGE3
 *   npm run cvm:audit:quarterly -- --ticker PETR4 --metric operatingCashFlow
 *
 * Options:
 *   --ticker TICKER    (required) B3 ticker to audit
 *   --metric METRIC    (default: revenue) one of: revenue, ebit, netIncome,
 *                      operatingCashFlow, capex, freeCashFlow, cash, totalDebt, netDebt
 *
 * For each fiscal year, shows:
 *   - Q1 / Q2 / Q3 / Q4 quarterly values with their source
 *   - Annual DFP value (from precomputed annual cache)
 *   - Sum of Q1+Q2+Q3+Q4
 *   - Difference: sum − annual (ideally ≈ 0; large deviation = parser bug)
 *
 * Note: Balance-sheet metrics (cash, totalDebt, netDebt) are point-in-time and
 * should NOT sum to the annual value. The "sum" and "diff" columns are shown
 * anyway for completeness but should be ignored for those metrics.
 *
 * Exit code 1 if ticker not found in the quarterly cache.
 */

import { readFileSync } from "fs";
import { join } from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

type ValidMetric =
  | "revenue" | "ebit" | "netIncome" | "operatingCashFlow" | "capex"
  | "freeCashFlow" | "cash" | "totalDebt" | "netDebt";

const VALID_METRICS: ValidMetric[] = [
  "revenue", "ebit", "netIncome", "operatingCashFlow", "capex",
  "freeCashFlow", "cash", "totalDebt", "netDebt",
];

const BALANCE_SHEET_METRICS: Set<ValidMetric> = new Set(["cash", "totalDebt", "netDebt"]);

interface QuarterlyRecord {
  ticker:            string;
  fiscalYear:        number;
  quarter:           1 | 2 | 3 | 4;
  period:            string;
  periodEndDate:     string;
  revenue:           number | null;
  ebit:              number | null;
  netIncome:         number | null;
  operatingCashFlow: number | null;
  capex:             number | null;
  freeCashFlow:      number | null;
  cash:              number | null;
  totalDebt:         number | null;
  netDebt:           number | null;
  source:            string;
}

interface QuarterlyCache {
  ticker:      string;
  companyName: string;
  generatedAt: string;
  quarterly:   QuarterlyRecord[];
}

interface AnnualRecord {
  fiscalYear:        number;
  revenue?:          number;
  ebit?:             number;
  netIncome?:        number;
  operatingCashFlow?: number;
  capex?:            number;
  freeCashFlow?:     number;
  cash?:             number;
  totalDebt?:        number;
  netDebt?:          number;
}

interface AnnualCache {
  financials: AnnualRecord[];
}

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const isTTY = process.stdout.isTTY;
const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";
const DIM    = "\x1b[2m";
const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";

function c(s: string, code: string): string {
  return isTTY ? `${code}${s}${RESET}` : s;
}

// ─── CLI args ─────────────────────────────────────────────────────────────────

function parseArgs(): { ticker: string; metric: ValidMetric } {
  const args = process.argv.slice(2);
  let ticker = "";
  let metric: ValidMetric = "revenue";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--ticker" && args[i + 1]) {
      ticker = args[++i].toUpperCase();
      continue;
    }
    if (args[i] === "--metric" && args[i + 1]) {
      const m = args[++i] as ValidMetric;
      if (!VALID_METRICS.includes(m)) {
        console.error(`Unknown metric "${m}". Valid metrics: ${VALID_METRICS.join(", ")}`);
        process.exit(1);
      }
      metric = m;
      continue;
    }
  }

  if (!ticker) {
    console.error("Usage: npm run cvm:audit:quarterly -- --ticker TICKER [--metric METRIC]");
    console.error(`Valid metrics: ${VALID_METRICS.join(", ")}`);
    process.exit(1);
  }

  return { ticker, metric };
}

// ─── Cache loading ────────────────────────────────────────────────────────────

const CACHE_ROOT = join(process.cwd(), "src/data/cvm-cache");

function loadQuarterlyCache(ticker: string): QuarterlyCache | null {
  try {
    const raw = readFileSync(join(CACHE_ROOT, "quarterly", `${ticker}.json`), "utf-8");
    return JSON.parse(raw) as QuarterlyCache;
  } catch {
    return null;
  }
}

function loadAnnualCache(ticker: string): AnnualRecord[] {
  try {
    const raw = readFileSync(join(CACHE_ROOT, "financials", `${ticker}.json`), "utf-8");
    const parsed = JSON.parse(raw) as AnnualCache;
    return Array.isArray(parsed.financials) ? parsed.financials : [];
  } catch {
    return [];
  }
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmtB(v: number | null): string {
  if (v === null) return "—";
  // Quarterly and annual caches store values already in BRL billions.
  return v.toFixed(4);
}

function padL(s: string, w: number): string { return s.padStart(w); }
function padR(s: string, w: number): string { return s.padEnd(w);   }

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const { ticker, metric } = parseArgs();
  const isBalanceSheet = BALANCE_SHEET_METRICS.has(metric);

  const quarterlyCache = loadQuarterlyCache(ticker);
  if (!quarterlyCache) {
    console.error(`No quarterly cache found for ${ticker}. Run: npm run cvm:precompute:quarterly`);
    process.exit(1);
  }

  const annualRecords = loadAnnualCache(ticker);

  const records = quarterlyCache.quarterly;
  const companyName = quarterlyCache.companyName;

  // Group by fiscal year
  const byYear = new Map<number, QuarterlyRecord[]>();
  for (const r of records) {
    let group = byYear.get(r.fiscalYear);
    if (!group) {
      group = [];
      byYear.set(r.fiscalYear, group);
    }
    group.push(r);
  }

  const years = Array.from(byYear.keys()).sort((a, b) => a - b);

  // Header
  console.log();
  console.log(c(`Quarterly Audit: ${ticker} — ${metric}`, BOLD));
  console.log(`${companyName}  |  Generated: ${quarterlyCache.generatedAt}`);
  if (isBalanceSheet) {
    console.log(c(`Note: "${metric}" is a balance-sheet (point-in-time) metric. Sum ≠ Annual is expected.`, YELLOW));
  }
  console.log();

  const COL = {
    fy:     4,
    q1:     12,
    q2:     12,
    q3:     12,
    q4:     12,
    annual: 12,
    sum:    12,
    diff:   12,
  };

  const HEADER = [
    padL("FY",     COL.fy),
    padL("Q1 (B)", COL.q1),
    padL("Q2 (B)", COL.q2),
    padL("Q3 (B)", COL.q3),
    padL("Q4 (B)", COL.q4),
    padL("Annual(B)", COL.annual),
    padL("Sum(B)",    COL.sum),
    padL("Diff(B)",   COL.diff),
    "Q1-src",
    "Q2-src",
    "Q3-src",
    "Q4-src",
  ].join("  ");

  console.log(c(HEADER, BOLD));
  console.log("─".repeat(HEADER.length + 4));

  for (const fy of years) {
    const quarters = (byYear.get(fy) ?? []).sort((a, b) => a.quarter - b.quarter);
    const q: (QuarterlyRecord | undefined)[] = [1, 2, 3, 4].map(n => quarters.find(r => r.quarter === n));

    const getVal = (r: QuarterlyRecord | undefined): number | null =>
      r ? ((r[metric] as number | null) ?? null) : null;

    const v1 = getVal(q[0]);
    const v2 = getVal(q[1]);
    const v3 = getVal(q[2]);
    const v4 = getVal(q[3]);

    const annualRecord = annualRecords.find(a => a.fiscalYear === fy);
    const annualVal = annualRecord
      ? ((annualRecord[metric] as number | undefined) ?? null)
      : null;

    const nonNullQuarters = [v1, v2, v3, v4].filter((v): v is number => v !== null);
    const sum = nonNullQuarters.length > 0 ? nonNullQuarters.reduce((a, b) => a + b, 0) : null;

    const diff = !isBalanceSheet && sum !== null && annualVal !== null ? sum - annualVal : null;

    // Color the diff cell
    let diffStr = fmtB(diff);
    if (diff !== null && Math.abs(diff) > 0.1) {
      diffStr = c(diffStr, RED);
    } else if (diff !== null) {
      diffStr = c(diffStr, GREEN);
    }

    const srcShort = (r: QuarterlyRecord | undefined): string => {
      if (!r) return "—";
      if (r.source === "cvm_itr")             return "itr";
      if (r.source === "cvm_dfp_derived_q4")  return "dfp-q4";
      return r.source.slice(0, 8);
    };

    console.log(
      [
        padL(String(fy), COL.fy),
        padL(fmtB(v1), COL.q1),
        padL(fmtB(v2), COL.q2),
        padL(fmtB(v3), COL.q3),
        padL(fmtB(v4), COL.q4),
        padL(fmtB(annualVal), COL.annual),
        padL(fmtB(sum), COL.sum),
        padL(diffStr, COL.diff + (diff !== null && Math.abs(diff) > 0.1 ? 10 : 0)),
        srcShort(q[0]),
        srcShort(q[1]),
        srcShort(q[2]),
        srcShort(q[3]),
      ].join("  "),
    );
  }

  console.log();

  // Summary
  let zeroQuarters = 0;
  let negativeQ4 = 0;
  for (const [, qs] of byYear) {
    for (const r of qs) {
      const v = r[metric] as number | null;
      if (v === 0) zeroQuarters++;
      if (r.quarter === 4 && v !== null && v < 0) negativeQ4++;
    }
  }

  if (zeroQuarters > 0) {
    console.log(c(`  Warning: ${zeroQuarters} quarter(s) report exactly zero for "${metric}" — cache may need regeneration.`, YELLOW));
  }
  if (negativeQ4 > 0) {
    console.log(c(`  Warning: ${negativeQ4} Q4 derived value(s) are negative for "${metric}" — indicates YTD double-counting bug.`, RED));
  }
  if (zeroQuarters === 0 && negativeQ4 === 0) {
    console.log(c(`  No obvious data integrity issues detected.`, GREEN));
  }
  console.log();
}

main();
