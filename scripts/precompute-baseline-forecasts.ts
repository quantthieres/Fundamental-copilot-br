/**
 * Precomputes baseline forecast caches for all tickers that have a
 * normalized time-series cache and writes one JSON file per ticker to
 * src/data/forecast-cache/baseline-forecasts/.
 *
 * Usage:
 *   npm run forecast:precompute:baseline
 *
 * Environment:
 *   FORECAST_HORIZON_QUARTERS  default 8
 *
 * This script is fully local and offline — it does NOT download CVM data,
 * call brapi, or invoke Python. It reads from the existing time-series cache
 * at src/data/forecast-cache/time-series/ and writes static JSON.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

import { buildBaselineForecastCache } from "../src/lib/forecasting/baseline-forecast-builder";
import { parseTimeSeriesCache } from "../src/lib/forecasting/time-series-cache";

// ─── Config ───────────────────────────────────────────────────────────────────

const INPUT_DIR  = join(process.cwd(), "src/data/forecast-cache/time-series");
const OUTPUT_DIR = join(process.cwd(), "src/data/forecast-cache/baseline-forecasts");

const HORIZON_QUARTERS = parseInt(
  process.env.FORECAST_HORIZON_QUARTERS ?? "8",
  10,
);

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  let files: string[];
  try {
    files = readdirSync(INPUT_DIR).filter(f => f.endsWith(".json"));
  } catch {
    console.error(`Input directory not found: ${INPUT_DIR}`);
    console.error("Run: npm run time-series:precompute");
    process.exit(1);
  }

  console.log(`\n[info] Found ${files.length} time-series cache files`);
  console.log(`[info] Horizon: ${HORIZON_QUARTERS} quarters`);
  console.log(`[info] Output: ${OUTPUT_DIR}\n`);

  const t0 = Date.now();
  let ok = 0, failed = 0, totalForecastPoints = 0, totalMetrics = 0;

  for (const file of files) {
    const ticker = file.replace(/\.json$/, "");
    try {
      const raw = readFileSync(join(INPUT_DIR, file), "utf-8");
      const tsCache = parseTimeSeriesCache(raw);
      if (!tsCache) {
        console.log(`[skip] ${ticker}: invalid time-series cache format`);
        failed++;
        continue;
      }

      const forecast = buildBaselineForecastCache(tsCache, {
        horizonQuarters: HORIZON_QUARTERS,
      });

      const points = forecast.forecasts.reduce(
        (sum, f) => sum + f.forecast.filter(p => p.yhat !== null).length,
        0,
      );
      const metricsWithForecast = forecast.forecasts.filter(
        f => f.forecast.some(p => p.yhat !== null),
      ).length;

      writeFileSync(
        join(OUTPUT_DIR, `${ticker}.json`),
        JSON.stringify(forecast, null, 2),
        "utf-8",
      );

      totalForecastPoints += points;
      totalMetrics += metricsWithForecast;
      console.log(
        `[ok]   ${ticker.padEnd(8)} ${metricsWithForecast} metrics, ${String(points).padStart(3)} forecast points`,
      );
      ok++;
    } catch (err) {
      console.log(`[err]  ${ticker}: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

  console.log("\n─────────────────────────────────────────");
  console.log(`  Total files processed : ${files.length}`);
  console.log(`  Successful            : ${ok}`);
  console.log(`  Failed                : ${failed}`);
  console.log(`  Metrics forecasted    : ${totalMetrics}`);
  console.log(`  Total forecast points : ${totalForecastPoints}`);
  console.log(`  Elapsed               : ${elapsed}s`);
  console.log("─────────────────────────────────────────\n");

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error("Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
