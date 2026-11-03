// Server-side only. Reads precomputed insurance cache JSON files.
// Do not import from client components.

import fs from "fs";
import path from "path";
import { resolveFundamentalsTicker } from "../coverage/fundamentals-alias";
import type { InsuranceAnalysisResponse } from "./insurance-types";

const CACHE_DIR = path.join(process.cwd(), "src/data/insurance-cache/annual");

// Aliased tickers (same issuer, see coverage/fundamentals-alias.ts) read the
// canonical cache; callers keep the requested ticker in their responses.
export function readInsuranceCache(ticker: string): InsuranceAnalysisResponse | null {
  const filePath = path.join(CACHE_DIR, `${resolveFundamentalsTicker(ticker)}.json`);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as InsuranceAnalysisResponse;
  } catch {
    return null;
  }
}

export function insuranceCacheExists(ticker: string): boolean {
  const filePath = path.join(CACHE_DIR, `${ticker.toUpperCase()}.json`);
  return fs.existsSync(filePath);
}
