// Server-side only. Orchestrates DFP zip downloads, caching, and row assembly.
import { unzipSync } from "fflate";
import type { RawCvmStatementRow, NormalizedFinancials } from "./types";
import { parseDfpCsv } from "./dfp-parser";
import { normalizeCvmRows } from "./normalizer";

const DFP_BASE = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/DADOS";

export const DFP_YEARS = [2020, 2021, 2022, 2023, 2024] as const;

// Statement types to fetch from each yearly zip.
const STATEMENT_TYPES = [
  "DRE_con",
  "BPA_con",
  "BPP_con",
  "DFC_MI_con",
  "DFC_MD_con",
] as const;

type DfpStatementType = (typeof STATEMENT_TYPES)[number];

// ─── Level-1 cache: raw zip buffers (1 h TTL) ─────────────────────────────────
// One zip per year (~13 MB). Keeps re-extractions cheap within a request burst.
const ZIP_TTL_MS = 60 * 60 * 1000;
const zipCache = new Map<number, { buffer: Uint8Array; loadedAt: number }>();

// ─── Level-2 cache: parsed+filtered rows (24 h TTL) ──────────────────────────
// Key: "year:stmtType:cvmCode"
const ROW_TTL_MS = 24 * 60 * 60 * 1000;
const rowCache = new Map<string, { rows: RawCvmStatementRow[]; loadedAt: number }>();

// ─── Zip download ─────────────────────────────────────────────────────────────

export async function fetchYearZip(year: number): Promise<Uint8Array | null> {
  const cached = zipCache.get(year);
  if (cached && Date.now() - cached.loadedAt < ZIP_TTL_MS) return cached.buffer;

  try {
    const url = `${DFP_BASE}/dfp_cia_aberta_${year}.zip`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;

    const buffer = new Uint8Array(await res.arrayBuffer());
    zipCache.set(year, { buffer, loadedAt: Date.now() });
    return buffer;
  } catch {
    return null;
  }
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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches and normalizes annual DFP financials for a company identified by
 * its CVM code. Returns one NormalizedFinancials entry per fiscal year found,
 * sorted ascending by year.
 *
 * Falls back gracefully to an empty array on any network or parse error.
 *
 * TODO: add disk caching (e.g. to /tmp) to survive server restarts and reduce
 * cold-start latency. The two-level in-memory cache is enough for development.
 */
export async function getAnnualDfpFinancials(
  ticker: string,
  cvmCode: string,
  years: readonly number[] = DFP_YEARS,
): Promise<NormalizedFinancials[]> {
  const results: NormalizedFinancials[] = [];

  for (const year of years) {
    const allRows: RawCvmStatementRow[] = [];

    // Fetch all statement types for this year in parallel.
    const statementRows = await Promise.all(
      STATEMENT_TYPES.map(stmtType => getDfpRows(year, stmtType, cvmCode)),
    );

    for (const rows of statementRows) allRows.push(...rows);

    if (allRows.length === 0) continue;

    // There should be exactly one DT_FIM_EXERC per year zip (ÚLTIMO only).
    // Use it to determine the fiscal year (more reliable than the zip year for
    // non-Dec fiscal year-end companies).
    const periodEnd = allRows[0].periodEndDate;
    const fiscalYear = new Date(periodEnd).getFullYear();

    const normalized = normalizeCvmRows(ticker, fiscalYear, allRows);
    results.push(normalized);
  }

  return results.sort((a, b) => a.fiscalYear - b.fiscalYear);
}
