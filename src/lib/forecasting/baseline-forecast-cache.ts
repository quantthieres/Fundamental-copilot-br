// Server-side only. Reads precomputed baseline forecast cache files written by
// scripts/precompute-baseline-forecasts.ts.
// Returns null on any failure so callers never need to catch in API usage.

import { readFileSync } from "fs";
import { join } from "path";
import type { BaselineForecastCache } from "./forecast-types";

const CACHE_DIR = join(
  process.cwd(),
  "src/data/forecast-cache/baseline-forecasts",
);

function normalizeTicker(ticker: string): string {
  return ticker.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Exported for testing.
export function parseBaselineForecastCache(raw: string): BaselineForecastCache | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.ticker !== "string") return null;
  if (obj.source !== "baseline_forecast_cache") return null;
  if (!Array.isArray(obj.forecasts)) return null;
  return obj as unknown as BaselineForecastCache;
}

export function getPrecomputedBaselineForecast(
  ticker: string,
): BaselineForecastCache | null {
  try {
    const raw = readFileSync(
      join(CACHE_DIR, `${normalizeTicker(ticker)}.json`),
      "utf-8",
    );
    return parseBaselineForecastCache(raw);
  } catch {
    return null;
  }
}
