// Server-side only. Reads precomputed bank cache JSON files.
// Do not import from client components.

import fs from "fs";
import path from "path";
import type { BankAnalysisResponse } from "./bank-types";

const CACHE_DIR = path.join(process.cwd(), "src/data/bank-cache/annual");

export function readBankCache(ticker: string): BankAnalysisResponse | null {
  const filePath = path.join(CACHE_DIR, `${ticker.toUpperCase()}.json`);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as BankAnalysisResponse;
  } catch {
    return null;
  }
}

export function bankCacheExists(ticker: string): boolean {
  const filePath = path.join(CACHE_DIR, `${ticker.toUpperCase()}.json`);
  return fs.existsSync(filePath);
}
