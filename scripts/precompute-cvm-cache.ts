/**
 * Precomputes CVM financial and document data for all covered tickers and
 * writes static JSON cache files to src/data/cvm-cache/.
 *
 * Usage:
 *   npm run cvm:precompute
 *
 * Files written:
 *   src/data/cvm-cache/financials/<TICKER>.json
 *   src/data/cvm-cache/documents/<TICKER>.json
 *
 * Covers all B3 tickers with:
 *   - hasCvmMapping: true
 *   - coverageStatus in { full_analysis, cvm_analysis, cvm_financials }
 *
 * Does NOT import @/ aliases — uses relative paths for tsx runtime compatibility.
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

import { B3_UNIVERSE } from "../src/data/b3-universe";
import { getCvmCompanyByTicker } from "../src/lib/cvm/company-map";
import { getAnnualDfpFinancials } from "../src/lib/cvm/dfp-client";
import { fetchCvmDocuments } from "../src/lib/cvm/documents-client";
import type { CoverageStatus } from "../src/data/coverage-types";

// ─── Config ───────────────────────────────────────────────────────────────────

const CONCURRENCY = 4;
const CACHE_ROOT = join(process.cwd(), "src/data/cvm-cache");

const ELIGIBLE_STATUSES = new Set<CoverageStatus>([
  "full_analysis",
  "cvm_analysis",
  "cvm_financials",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

// ─── Per-ticker processing ────────────────────────────────────────────────────

interface TickerResult {
  ticker: string;
  status: "ok" | "empty" | "error";
  financialsYears: number;
  documentsCount: number;
  error?: string;
}

async function processTicker(ticker: string): Promise<TickerResult> {
  const company = getCvmCompanyByTicker(ticker);

  if (!company || !company.hasCvmMapping || !company.cvmCode) {
    return { ticker, status: "error", financialsYears: 0, documentsCount: 0, error: "No verified CVM mapping" };
  }

  const { cvmCode, companyName } = company;

  let financialsYears = 0;
  let documentsCount = 0;
  const errors: string[] = [];

  // ── Financials ──────────────────────────────────────────────────────────────
  try {
    const financials = await getAnnualDfpFinancials(ticker, cvmCode);
    financialsYears = financials.length;
    const financialsPath = join(CACHE_ROOT, "financials", `${ticker}.json`);
    writeFileSync(financialsPath, JSON.stringify({ ticker, companyName, generatedAt: new Date().toISOString(), financials }, null, 2), "utf-8");
  } catch (err) {
    errors.push(`financials: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Documents ───────────────────────────────────────────────────────────────
  try {
    const documents = await fetchCvmDocuments(ticker, cvmCode);
    documentsCount = documents.length;
    const documentsPath = join(CACHE_ROOT, "documents", `${ticker}.json`);
    writeFileSync(documentsPath, JSON.stringify({ ticker, companyName, generatedAt: new Date().toISOString(), documents }, null, 2), "utf-8");
  } catch (err) {
    errors.push(`documents: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (errors.length > 0) {
    return { ticker, status: "error", financialsYears, documentsCount, error: errors.join("; ") };
  }

  const status = financialsYears === 0 && documentsCount === 0 ? "empty" : "ok";
  return { ticker, status, financialsYears, documentsCount };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Ensure output directories exist.
  mkdirSync(join(CACHE_ROOT, "financials"), { recursive: true });
  mkdirSync(join(CACHE_ROOT, "documents"), { recursive: true });

  const tickers = B3_UNIVERSE
    .filter(a => a.hasCvmMapping && ELIGIBLE_STATUSES.has(a.coverageStatus))
    .map(a => a.ticker);

  console.log(`\nPrecomputing CVM cache for ${tickers.length} tickers (concurrency=${CONCURRENCY})...\n`);

  const tasks = tickers.map(ticker => async () => {
    process.stdout.write(`  [${ticker}] fetching...`);
    const result = await processTicker(ticker);
    const tag = result.status === "ok" ? "OK" : result.status === "empty" ? "EMPTY" : "ERROR";
    const detail =
      result.status === "error"
        ? ` — ${result.error}`
        : ` (${result.financialsYears} years, ${result.documentsCount} docs)`;
    console.log(`\r  [${ticker}] ${tag}${detail}`);
    return result;
  });

  const results = await runWithConcurrency(tasks, CONCURRENCY);

  // ── Summary ─────────────────────────────────────────────────────────────────

  const ok    = results.filter(r => r.status === "ok");
  const empty = results.filter(r => r.status === "empty");
  const error = results.filter(r => r.status === "error");

  console.log("\n─────────────────────────────────────────");
  console.log(`  Total tickers: ${tickers.length}`);
  console.log(`  OK:            ${ok.length}`);
  console.log(`  Empty:         ${empty.length}`);
  console.log(`  Error:         ${error.length}`);

  if (empty.length > 0) {
    console.log(`\n  Empty tickers: ${empty.map(r => r.ticker).join(", ")}`);
  }

  if (error.length > 0) {
    console.log("\n  Failed tickers:");
    for (const r of error) {
      console.log(`    ${r.ticker}: ${r.error}`);
    }
  }

  console.log("─────────────────────────────────────────\n");

  if (error.length > 0) process.exit(1);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
