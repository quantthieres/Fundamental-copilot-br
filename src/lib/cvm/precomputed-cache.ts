// Server-side only. Reads precomputed CVM cache files written by
// scripts/precompute-cvm-cache.ts and scripts/precompute-cvm-quarterly-cache.ts.
// Returns null on any failure so callers can fall through to the live pipeline.

import { readFileSync } from "fs";
import { join } from "path";
import type { NormalizedFinancials, QuarterlyFinancialRecord } from "./types";
import type { CvmDocument } from "./documents-types";

const CACHE_ROOT = join(process.cwd(), "src/data/cvm-cache");

function normalizeTicker(ticker: string): string {
  return ticker.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function readCacheFile(subdir: string, ticker: string): string | null {
  try {
    return readFileSync(join(CACHE_ROOT, subdir, `${normalizeTicker(ticker)}.json`), "utf-8");
  } catch {
    return null;
  }
}

// ─── Pure validators (exported for testing) ───────────────────────────────────

export function parseFinancialsCache(raw: string): NormalizedFinancials[] | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.financials)) return null;
  return obj.financials as NormalizedFinancials[];
}

export function parseDocumentsCache(raw: string): { documents: CvmDocument[]; companyName: string } | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.documents)) return null;
  if (typeof obj.companyName !== "string") return null;
  return { documents: obj.documents as CvmDocument[], companyName: obj.companyName };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getPrecomputedFinancials(ticker: string): NormalizedFinancials[] | null {
  const raw = readCacheFile("financials", ticker);
  if (!raw) return null;
  return parseFinancialsCache(raw);
}

export function getPrecomputedDocuments(ticker: string): { documents: CvmDocument[]; companyName: string } | null {
  const raw = readCacheFile("documents", ticker);
  if (!raw) return null;
  return parseDocumentsCache(raw);
}

// ─── Quarterly cache ──────────────────────────────────────────────────────────

export function parseQuarterlyCache(raw: string): QuarterlyFinancialRecord[] | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.quarterly)) return null;
  // Basic shape check on the first element when the array is non-empty.
  if (obj.quarterly.length > 0) {
    const first = obj.quarterly[0] as Record<string, unknown>;
    if (typeof first.ticker      !== "string") return null;
    if (typeof first.fiscalYear  !== "number") return null;
    if (typeof first.quarter     !== "number") return null;
    if (typeof first.period      !== "string") return null;
    if (typeof first.source      !== "string") return null;
  }
  return obj.quarterly as QuarterlyFinancialRecord[];
}

export function getPrecomputedQuarterlyFinancials(ticker: string): QuarterlyFinancialRecord[] | null {
  const raw = readCacheFile("quarterly", ticker);
  if (!raw) return null;
  return parseQuarterlyCache(raw);
}
