// Holding cache I/O. Server-side / scripts only — reads committed JSON, never
// the issuers' sources.
//
// One file per issuer, keyed by the canonical ticker (src/data/holding-cache/
// ITSA4.json, BRAP4.json). Other share classes (ITSA3, BRAP3) read their
// issuer's file through the holding-specific alias in holding-identities.ts —
// fundamentals only; quotes stay ticker-specific.
//
// No @/ imports — also used by tsx scripts.

import fs from "fs";
import path from "path";
import { resolveHoldingCacheTicker } from "./holding-identities";
import type { HoldingCache } from "./holding-types";

export const HOLDING_CACHE_DIR = path.join(process.cwd(), "src/data/holding-cache");

export function holdingCachePath(canonicalTicker: string, dir = HOLDING_CACHE_DIR): string {
  return path.join(dir, `${canonicalTicker.toUpperCase()}.json`);
}

/** Issuer cache for any share class of a covered holding, else null. */
export function readHoldingCache(ticker: string, dir = HOLDING_CACHE_DIR): HoldingCache | null {
  const canonical = resolveHoldingCacheTicker(ticker);
  if (!canonical) return null;
  try {
    return JSON.parse(fs.readFileSync(holdingCachePath(canonical, dir), "utf-8")) as HoldingCache;
  } catch {
    return null;
  }
}

/** Stable serialization: key order follows the builders; only updatedAt varies. */
export function serializeHoldingCache(cache: HoldingCache): string {
  return `${JSON.stringify(cache, null, 2)}\n`;
}

export function writeHoldingCache(cache: HoldingCache, dir = HOLDING_CACHE_DIR): string {
  fs.mkdirSync(dir, { recursive: true });
  const file = holdingCachePath(cache.ticker, dir);
  fs.writeFileSync(file, serializeHoldingCache(cache), "utf-8");
  return file;
}
