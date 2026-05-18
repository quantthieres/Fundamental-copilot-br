// Server-side only. Reads precomputed insurance cache JSON files.
// Do not import from client components.

import fs from "fs";
import path from "path";
import type { InsuranceAnalysisResponse } from "./insurance-types";

const CACHE_DIR = path.join(process.cwd(), "src/data/insurance-cache/annual");

export function readInsuranceCache(ticker: string): InsuranceAnalysisResponse | null {
  const filePath = path.join(CACHE_DIR, `${ticker.toUpperCase()}.json`);
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
