/**
 * Precomputes FII analysis from CVM informe mensal for all FII tickers in the
 * B3 universe and writes cache files to src/data/fii-cache/monthly/<TICKER>.json.
 *
 * Usage:
 *   npm run fii:precompute
 *   FII_PRECOMPUTE_TICKERS=MXRF11,HGLG11 npm run fii:precompute   # subset
 *   FII_PRECOMPUTE_CONCURRENCY=2 npm run fii:precompute            # parallel
 *   npm run fii:precompute -- --skip-existing
 *
 * Data source: CVM FII informe mensal (annual ZIPs, complemento CSV).
 * FIIs do NOT file company DFPs — the industrial/bank DFP pipeline is not used.
 *
 * After a successful run:
 *   Update CACHED_TICKERS in src/lib/fiis/fii-coverage.ts with the OK tickers.
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

import { B3_UNIVERSE } from "../src/data/b3-universe";
import { classifyAsset } from "../src/lib/coverage/asset-classifier";
import {
  buildFiiRegistry,
  findFundCnpj,
  fetchAllMonthlyRows,
  clearZipCache,
} from "../src/lib/fiis/fii-cvm-client";
import type { FiiAnalysisResponse, FiiFinancialRecord } from "../src/lib/fiis/fii-types";

// ─── Config ───────────────────────────────────────────────────────────────────

const CONCURRENCY   = Number(process.env.FII_PRECOMPUTE_CONCURRENCY ?? 1);
const CACHE_DIR     = join(process.cwd(), "src/data/fii-cache/monthly");
const SKIP_EXISTING = process.argv.includes("--skip-existing");

// Fetch last 2 complete years + current year for full 12m distribution history.
const currentYear = new Date().getFullYear();
const FETCH_YEARS = [currentYear - 1, currentYear];

// Registry built from most recent complete year
const REGISTRY_YEAR = currentYear - 1;

// CNPJ overrides — required when fund name matching cannot unambiguously
// identify the fund (e.g. fund was renamed after manager change).
const FII_CNPJ_OVERRIDES: Record<string, string> = {
  HGLG11: "11.728.688/0001-47", // Renamed: CSHG Logística → Pátria Log FII
  IRDM11: "28.830.325/0001-10", // Registry name: IRIDIUM REC IMOB FII
  KNCR11: "16.706.958/0001-32", // Renamed: Kinea CRI → Kinea Rendimentos Imob FII
  HGRE11: "09.072.017/0001-29", // Renamed: CSHG Real Estate → Pátria Escritórios FII
};

// ─── Per-ticker processing ────────────────────────────────────────────────────

interface TickerResult {
  ticker: string;
  status: "ok" | "no_cnpj" | "no_data" | "skipped" | "error";
  monthsFound: number;
  error?: string;
  warnings: string[];
}

async function processTicker(
  ticker: string,
  companyName: string,
  registry: Awaited<ReturnType<typeof buildFiiRegistry>>,
): Promise<TickerResult> {
  const outPath = join(CACHE_DIR, `${ticker}.json`);

  if (SKIP_EXISTING && existsSync(outPath)) {
    return { ticker, status: "skipped", monthsFound: 0, warnings: [] };
  }

  const cnpj = findFundCnpj(ticker, companyName, registry, FII_CNPJ_OVERRIDES);
  if (!cnpj) {
    console.log(`  [${ticker}] CNPJ not found — writing unavailable cache`);
    writeUnavailable(ticker, companyName, outPath, [
      `CNPJ not found for "${companyName}". Add to FII_CNPJ_OVERRIDES if known.`,
    ]);
    return {
      ticker, status: "no_cnpj", monthsFound: 0,
      error: "CNPJ not found in CVM informe mensal geral CSV",
      warnings: [],
    };
  }

  console.log(`  [${ticker}] CNPJ: ${cnpj}`);

  const rawRows = await fetchAllMonthlyRows(cnpj, FETCH_YEARS);
  clearZipCache();

  if (rawRows.length === 0) {
    console.log(`  [${ticker}] No monthly data found`);
    writeUnavailable(ticker, companyName, outPath, [
      `No informe mensal data found for CNPJ ${cnpj}.`,
    ]);
    return { ticker, status: "no_data", monthsFound: 0, error: "No monthly records", warnings: [] };
  }

  // Deduplicate by referenceDate (keep latest version if multiple)
  const byDate = new Map<string, FiiFinancialRecord>();
  for (const r of rawRows) {
    byDate.set(r.referenceDate, {
      ticker,
      referenceDate:               r.referenceDate,
      netAssetValue:               r.netAssetValue,
      quotaCount:                  r.quotaCount,
      netAssetValuePerShare:       r.netAssetValuePerShare,
      monthlyDistributionPerShare: r.monthlyDistributionPerShare,
      source: "fii_cvm_cache",
    });
  }
  const records = [...byDate.values()].sort((a, b) =>
    a.referenceDate < b.referenceDate ? -1 : 1,
  );

  // Keep last 24 months (sufficient for 12m distribution sum + history table)
  const trimmed = records.slice(-24);

  const response: FiiAnalysisResponse = {
    ticker,
    source: "fii_analysis",
    sourceDetail: "fii_cvm_cache",
    available: true,
    fund: { ticker, name: companyName, cnpj },
    records: trimmed,
    indicators: null, // market-dependent indicators computed at render time
    updatedAt: new Date().toISOString(),
    warnings: [],
  };

  writeFileSync(outPath, JSON.stringify(response, null, 2), "utf-8");
  console.log(`  [${ticker}] OK — ${trimmed.length} months`);
  return { ticker, status: "ok", monthsFound: trimmed.length, warnings: [] };
}

function writeUnavailable(
  ticker: string,
  companyName: string,
  outPath: string,
  warnings: string[],
): void {
  const response: FiiAnalysisResponse = {
    ticker,
    source: "fii_analysis",
    sourceDetail: "fii_unavailable",
    available: false,
    fund: { ticker, name: companyName },
    records: [],
    indicators: null,
    updatedAt: new Date().toISOString(),
    warnings,
  };
  writeFileSync(outPath, JSON.stringify(response, null, 2), "utf-8");
}

// ─── Concurrency helper ───────────────────────────────────────────────────────

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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  mkdirSync(CACHE_DIR, { recursive: true });

  const allFiiAssets = B3_UNIVERSE.filter(a => {
    const richType = classifyAsset(a.ticker, {
      b3AssetType: a.assetType,
      sector:      a.sector,
      companyName: a.companyName,
    });
    return richType === "fii";
  });

  const tickerFilter = process.env.FII_PRECOMPUTE_TICKERS
    ? new Set(process.env.FII_PRECOMPUTE_TICKERS.split(",").map(t => t.trim().toUpperCase()))
    : null;

  const targets = tickerFilter
    ? allFiiAssets.filter(a => tickerFilter.has(a.ticker))
    : allFiiAssets;

  if (targets.length === 0) {
    console.log("No FII targets found. Check B3_UNIVERSE or FII_PRECOMPUTE_TICKERS filter.");
    return;
  }

  console.log(`\nFII precompute — ${targets.length} FII tickers (concurrency=${CONCURRENCY})`);
  console.log(`Fetching years: ${FETCH_YEARS.join(", ")}\n`);

  console.log(`Building FII registry from ${REGISTRY_YEAR} informe mensal...`);
  const registry = await buildFiiRegistry(REGISTRY_YEAR);
  console.log(`Registry: ${registry.length} unique FII CNPJs\n`);

  const tasks = targets.map(a => async () => {
    process.stdout.write(`\n[${a.ticker}] ${a.companyName}\n`);
    return processTicker(a.ticker, a.companyName, registry);
  });

  const results = await runWithConcurrency(tasks, CONCURRENCY);

  const ok      = results.filter(r => r.status === "ok");
  const noCode  = results.filter(r => r.status === "no_cnpj");
  const noData  = results.filter(r => r.status === "no_data");
  const skipped = results.filter(r => r.status === "skipped");
  const errors  = results.filter(r => r.status === "error");

  console.log("\n─────────────────────────────────────────");
  console.log(`  Total FIIs:   ${results.length}`);
  console.log(`  OK:           ${ok.length}`);
  console.log(`  No CNPJ:      ${noCode.length}`);
  console.log(`  No data:      ${noData.length}`);
  console.log(`  Skipped:      ${skipped.length}`);
  console.log(`  Error:        ${errors.length}`);

  if (noCode.length > 0) {
    console.log("\n  Tickers without CNPJ match — add to FII_CNPJ_OVERRIDES if known:");
    for (const r of noCode) console.log(`    // ${r.ticker}: "NN.NNN.NNN/NNNN-NN",`);
  }
  if (ok.length > 0) {
    console.log("\n  Successful tickers — update CACHED_TICKERS in src/lib/fiis/fii-coverage.ts:");
    console.log(`    ${ok.map(r => `"${r.ticker}"`).join(",\n    ")}`);
  }

  console.log("\nDone. Cache written to src/data/fii-cache/monthly/\n");
}

main().catch(err => {
  console.error("FII precompute failed:", err);
  process.exit(1);
});
