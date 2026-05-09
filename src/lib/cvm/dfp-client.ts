// Server-side only. Orchestrates DFP zip downloads, caching, and row assembly.
import { unzipSync } from "fflate";
import type { RawCvmStatementRow, NormalizedFinancials } from "./types";
import { parseDfpCsv } from "./dfp-parser";
import { normalizeCvmRows } from "./normalizer";

const DFP_BASE = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/DADOS";

export const DFP_YEARS = [2020, 2021, 2022, 2023, 2024] as const;

const STATEMENT_TYPES = [
  "DRE_con",
  "BPA_con",
  "BPP_con",
  "DFC_MI_con",
  "DFC_MD_con",
] as const;

type DfpStatementType = (typeof STATEMENT_TYPES)[number];

// ─── Level-1 cache: raw zip buffers (1 h TTL) ─────────────────────────────────
// One zip per year (~13 MB). Shared with documents-client.ts.
const ZIP_TTL_MS = 60 * 60 * 1000;
const zipCache = new Map<number, { buffer: Uint8Array; loadedAt: number }>();

// In-flight dedup: concurrent callers for the same year share one download.
const zipInflight = new Map<number, Promise<Uint8Array | null>>();

// ─── Level-2 cache: parsed+filtered rows (24 h TTL) ──────────────────────────
// Key: "year:stmtType:cvmCode"
const ROW_TTL_MS = 24 * 60 * 60 * 1000;
const rowCache = new Map<string, { rows: RawCvmStatementRow[]; loadedAt: number }>();

// ─── Level-3 cache: normalized financials per ticker (24 h TTL) ──────────────
// Key: "ticker:cvmCode" — skips all parsing/normalization on warm hits.
const FINANCIALS_TTL_MS = 24 * 60 * 60 * 1000;
const financialsCache = new Map<string, { data: NormalizedFinancials[]; loadedAt: number }>();

// In-flight dedup: concurrent requests for the same ticker share one pipeline.
const financialsInflight = new Map<string, Promise<NormalizedFinancials[]>>();

// ─── Zip download ─────────────────────────────────────────────────────────────

export async function fetchYearZip(year: number): Promise<Uint8Array | null> {
  const cached = zipCache.get(year);
  if (cached && Date.now() - cached.loadedAt < ZIP_TTL_MS) return cached.buffer;

  // All concurrent callers for the same year join the same download promise.
  const inFlight = zipInflight.get(year);
  if (inFlight) return inFlight;

  const url = `${DFP_BASE}/dfp_cia_aberta_${year}.zip`;
  const p = fetch(url, { cache: "no-store" })
    .then(async (res): Promise<Uint8Array | null> => {
      if (!res.ok) return null;
      const buffer = new Uint8Array(await res.arrayBuffer());
      zipCache.set(year, { buffer, loadedAt: Date.now() });
      return buffer;
    })
    .catch((): null => null)
    .finally(() => zipInflight.delete(year));

  zipInflight.set(year, p);
  return p;
}

// ─── Statement extraction and parsing ────────────────────────────────────────

async function getDfpRows(
  year: number,
  stmtType: DfpStatementType,
  cvmCode: string,
): Promise<RawCvmStatementRow[]> {
  const cacheKey = `${year}:${stmtType}:${cvmCode}`;
  const cached = rowCache.get(cacheKey);
  if (cached && Date.now() - cached.loadedAt < ROW_TTL_MS) return cached.rows;

  const zip = await fetchYearZip(year);
  if (!zip) return [];

  const filename = `dfp_cia_aberta_${stmtType}_${year}.csv`;
  let extracted: { [key: string]: Uint8Array };
  try {
    extracted = unzipSync(zip, { filter: (f) => f.name === filename });
  } catch {
    return [];
  }

  const fileBytes = extracted[filename];
  if (!fileBytes) return [];

  const text = new TextDecoder("latin1").decode(fileBytes);
  const stmtLabel = stmtType.replace("_con", "").replace("_ind", "");
  const rows = parseDfpCsv(text, cvmCode, stmtLabel);

  rowCache.set(cacheKey, { rows, loadedAt: Date.now() });
  return rows;
}

// ─── Per-year processing ──────────────────────────────────────────────────────

async function processYear(
  year: number,
  ticker: string,
  cvmCode: string,
): Promise<NormalizedFinancials | null> {
  // All 5 statement types for this year are fetched concurrently.
  // fetchYearZip in-flight dedup ensures the zip is only downloaded once.
  const statementRows = await Promise.all(
    STATEMENT_TYPES.map(stmtType => getDfpRows(year, stmtType, cvmCode)),
  );

  const allRows = statementRows.flat();
  if (allRows.length === 0) return null;

  const periodEnd  = allRows[0].periodEndDate;
  const fiscalYear = new Date(periodEnd).getFullYear();
  return normalizeCvmRows(ticker, fiscalYear, allRows);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches and normalizes annual DFP financials for a company.
 *
 * Three-level cache strategy:
 *   L1  raw zip buffers  (1 h TTL)  — shared with documents-client
 *   L2  parsed rows      (24 h TTL) — per year × statement type × ticker
 *   L3  normalized data  (24 h TTL) — per ticker; avoids re-normalization
 *
 * In-flight deduplication is applied at both the zip (L1) and ticker (L3)
 * levels, so concurrent requests for the same ticker share a single run.
 *
 * All DFP years are processed concurrently; results are sorted ascending
 * by fiscal year.
 */
export async function getAnnualDfpFinancials(
  ticker: string,
  cvmCode: string,
  years: readonly number[] = DFP_YEARS,
): Promise<NormalizedFinancials[]> {
  const key = `${ticker}:${cvmCode}`;

  // L3: normalized result cache — fastest path, no computation needed.
  const cached = financialsCache.get(key);
  if (cached && Date.now() - cached.loadedAt < FINANCIALS_TTL_MS) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[dfp] ${ticker}: L3 cache hit`);
    }
    return cached.data;
  }

  // In-flight dedup: join an existing pipeline if one is running.
  const inFlight = financialsInflight.get(key);
  if (inFlight) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[dfp] ${ticker}: joining in-flight pipeline`);
    }
    return inFlight;
  }

  const p = (async () => {
    const t0 = Date.now();
    if (process.env.NODE_ENV === "development") {
      console.log(`[dfp] ${ticker}: pipeline start — years [${years.join(",")}]`);
    }

    // All years are processed concurrently. Each year's 5 statement types are
    // also concurrent. The zip in-flight dedup in fetchYearZip ensures each
    // yearly zip is downloaded exactly once even with concurrent statement fetches.
    const yearResults = await Promise.all(
      years.map(year => processYear(year, ticker, cvmCode)),
    );

    const data = yearResults
      .filter((r): r is NormalizedFinancials => r !== null)
      .sort((a, b) => a.fiscalYear - b.fiscalYear);

    financialsCache.set(key, { data, loadedAt: Date.now() });

    if (process.env.NODE_ENV === "development") {
      console.log(`[dfp] ${ticker}: pipeline done in ${Date.now() - t0}ms — ${data.length} fiscal years`);
    }

    return data;
  })();

  financialsInflight.set(key, p);
  p.finally(() => financialsInflight.delete(key));
  return p;
}
