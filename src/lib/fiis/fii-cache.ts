import fs from "fs";
import path from "path";
import type { FiiAnalysisResponse } from "./fii-types";

const CACHE_DIR = path.join(process.cwd(), "src/data/fii-cache/monthly");

export function readFiiCache(ticker: string): FiiAnalysisResponse | null {
  const filePath = path.join(CACHE_DIR, `${ticker.toUpperCase()}.json`);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as FiiAnalysisResponse;
  } catch {
    return null;
  }
}

export function fiiCacheExists(ticker: string): boolean {
  const filePath = path.join(CACHE_DIR, `${ticker.toUpperCase()}.json`);
  return fs.existsSync(filePath);
}
