// Generates normalized financial time-series cache from the precomputed CVM quarterly cache.
// Reads: src/data/cvm-cache/quarterly/<TICKER>.json
// Writes: src/data/forecast-cache/time-series/<TICKER>.json
//
// Usage:
//   npm run time-series:precompute
//
// Fully local — no CVM downloads, no network calls.

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { QuarterlyFinancialRecord } from "@/lib/cvm/types";
import { buildTickerTimeSeriesCache } from "@/lib/forecasting/time-series-builder";

const QUARTERLY_CACHE_DIR = join(
  process.cwd(),
  "src/data/cvm-cache/quarterly",
);
const OUTPUT_DIR = join(
  process.cwd(),
  "src/data/forecast-cache/time-series",
);

type QuarterlyCacheFile = {
  ticker: string;
  companyName: string;
  quarterly: QuarterlyFinancialRecord[];
};

function readQuarterlyCacheFile(filePath: string): QuarterlyCacheFile | null {
  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.ticker !== "string") return null;
    if (typeof obj.companyName !== "string") return null;
    if (!Array.isArray(obj.quarterly)) return null;
    return { ticker: obj.ticker, companyName: obj.companyName, quarterly: obj.quarterly as QuarterlyFinancialRecord[] };
  } catch {
    return null;
  }
}

function main(): void {
  const t0 = Date.now();

  mkdirSync(OUTPUT_DIR, { recursive: true });

  let files: string[];
  try {
    files = readdirSync(QUARTERLY_CACHE_DIR).filter((f) => f.endsWith(".json"));
  } catch (err) {
    console.error(`[error] Cannot read quarterly cache directory: ${QUARTERLY_CACHE_DIR}`);
    console.error(err);
    process.exit(1);
  }

  console.log(`[info] Found ${files.length} quarterly cache files`);
  console.log(`[info] Output directory: ${OUTPUT_DIR}`);
  console.log("");

  let successful = 0;
  let failed = 0;
  let totalSeries = 0;
  let totalPoints = 0;

  for (const file of files) {
    const ticker = file.replace(".json", "");
    const filePath = join(QUARTERLY_CACHE_DIR, file);
    const outputPath = join(OUTPUT_DIR, file);

    try {
      const input = readQuarterlyCacheFile(filePath);
      if (!input) {
        console.warn(`[warn] ${ticker}: failed to parse cache file — skipping`);
        failed++;
        continue;
      }

      const cache = buildTickerTimeSeriesCache(input);
      const points = cache.series.reduce((sum, s) => sum + s.points.length, 0);

      writeFileSync(outputPath, JSON.stringify(cache, null, 2), "utf-8");

      console.log(
        `[ok]   ${ticker.padEnd(8)} ${cache.series.length} series, ${String(points).padStart(4)} points` +
          (cache.warnings.length > 0 ? ` (${cache.warnings.length} warning${cache.warnings.length > 1 ? "s" : ""})` : ""),
      );

      successful++;
      totalSeries += cache.series.length;
      totalPoints += points;
    } catch (err) {
      console.error(`[error] ${ticker}:`, err);
      failed++;
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

  console.log("");
  console.log("─────────────────────────────────────");
  console.log(`Total files processed : ${files.length}`);
  console.log(`Successful            : ${successful}`);
  console.log(`Failed                : ${failed}`);
  console.log(`Total series generated: ${totalSeries}`);
  console.log(`Total points generated: ${totalPoints}`);
  console.log(`Elapsed               : ${elapsed}s`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
