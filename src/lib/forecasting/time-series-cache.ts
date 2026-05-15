// Server-side only. Reads precomputed normalized time-series cache files written by
// scripts/precompute-time-series-cache.ts.
// Returns null on any failure so callers never need to catch in API usage.

import { readFileSync } from "fs";
import { join } from "path";
import type { TickerTimeSeriesCache } from "./time-series-types";

const CACHE_DIR = join(
  process.cwd(),
  "src/data/forecast-cache/time-series",
);

function normalizeTicker(ticker: string): string {
  return ticker.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Pure validator exported for testing.
export function parseTimeSeriesCache(raw: string): TickerTimeSeriesCache | null {
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
  if (obj.source !== "normalized_financial_time_series") return null;
  if (!Array.isArray(obj.series)) return null;
  return obj as unknown as TickerTimeSeriesCache;
}

export function getPrecomputedTickerTimeSeries(
  ticker: string,
): TickerTimeSeriesCache | null {
  try {
    const raw = readFileSync(
      join(CACHE_DIR, `${normalizeTicker(ticker)}.json`),
      "utf-8",
    );
    return parseTimeSeriesCache(raw);
  } catch {
    return null;
  }
}
