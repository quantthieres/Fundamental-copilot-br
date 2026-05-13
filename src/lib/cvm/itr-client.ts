// Server-side only. Orchestrates ITR zip downloads, caching, and row assembly.
// Mirrors dfp-client.ts but targets CVM ITR (quarterly) Dados Abertos files.
import { unzipSync } from "fflate";
import type { RawCvmStatementRow, NormalizedFinancials, QuarterlyFinancialRecord } from "./types";
import { parseDfpCsv } from "./dfp-parser";
import { snapshotFromRows, buildQuarterlyRecords } from "./itr-quarterly";

const ITR_BASE = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/ITR/DADOS";

const DEFAULT_ITR_START_YEAR = 2018;

const STATEMENT_TYPES = [
  "DRE_con",
  "BPA_con",
  "BPP_con",
  "DFC_MI_con",
  "DFC_MD_con",
] as const;

type ItrStatementType = (typeof STATEMENT_TYPES)[number];

// ─── Level-1 cache: raw zip buffers (1 h TTL) ─────────────────────────────────
// One zip per year. Shared across all tickers processed in the same Node process.
const ZIP_TTL_MS = 60 * 60 * 1000;
const zipCache = new Map<number, { buffer: Uint8Array; loadedAt: number }>();
const zipInflight = new Map<number, Promise<Uint8Array | null>>();

/**
 * Releases all in-memory ZIP buffers. Call this from the precompute script
 * after each ticker to bound peak memory when many years are loaded.
 * The next ticker that needs a year will re-download it.
 */
export function clearItrZipCache(): void {
  zipCache.clear();
}

export async function fetchItrYearZip(year: number): Promise<Uint8Array | null> {
  const cached = zipCache.get(year);
  if (cached && Date.now() - cached.loadedAt < ZIP_TTL_MS) return cached.buffer;

  const inflight = zipInflight.get(year);
  if (inflight) return inflight;

  const url = `${ITR_BASE}/itr_cia_aberta_${year}.zip`;
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

// ─── Level-2 cache: parsed+filtered rows (24 h TTL) ──────────────────────────
// Key: "itr:year:stmtType:cvmCode" — per-company rows for one statement.
const ROW_TTL_MS = 24 * 60 * 60 * 1000;
const rowCache = new Map<string, { rows: RawCvmStatementRow[]; loadedAt: number }>();

async function getItrRows(
  year: number,
  stmtType: ItrStatementType,
  cvmCode: string,
): Promise<RawCvmStatementRow[]> {
  const cacheKey = `itr:${year}:${stmtType}:${cvmCode}`;
  const cached = rowCache.get(cacheKey);
  if (cached && Date.now() - cached.loadedAt < ROW_TTL_MS) return cached.rows;

  const zip = await fetchItrYearZip(year);
  if (!zip) return [];

  const filename = `itr_cia_aberta_${stmtType}_${year}.csv`;
  let extracted: { [key: string]: Uint8Array };
  try {
    extracted = unzipSync(zip, { filter: (f) => f.name === filename });
  } catch {
    return [];
  }

  const fileBytes = extracted[filename];
  if (!fileBytes) return [];

  const text = new TextDecoder("latin1").decode(fileBytes);
  // Strip the _con suffix to get the base statement label (DRE, BPA, etc.)
  const stmtLabel = stmtType.replace(/_con$/, "").replace(/_ind$/, "");
  const rows = parseDfpCsv(text, cvmCode, stmtLabel);

  rowCache.set(cacheKey, { rows, loadedAt: Date.now() });
  return rows;
}

// ─── Per-year quarterly processing ───────────────────────────────────────────

async function processYear(
  year: number,
  ticker: string,
  cvmCode: string,
  annualRecord: NormalizedFinancials | undefined,
): Promise<QuarterlyFinancialRecord[]> {
  // Fetch statement types sequentially — each call decompresses a large CSV
  // string from the ZIP (~66–150 MB uncompressed). Sequential processing lets
  // V8 collect the previous string before the next one is allocated, keeping
  // peak memory bounded to roughly one decompressed CSV at a time.
  const allRows: RawCvmStatementRow[] = [];
  for (const stmtType of STATEMENT_TYPES) {
    const rows = await getItrRows(year, stmtType, cvmCode);
    allRows.push(...rows);
  }
  if (allRows.length === 0) return [];

  // Group rows by periodEndDate — each distinct date is one ITR quarter.
  const rowsByPeriod = new Map<string, RawCvmStatementRow[]>();
  for (const row of allRows) {
    let bucket = rowsByPeriod.get(row.periodEndDate);
    if (!bucket) {
      bucket = [];
      rowsByPeriod.set(row.periodEndDate, bucket);
    }
    bucket.push(row);
  }

  // Build cumulative snapshots; skip non-standard period ends (e.g., Dec 31).
  const snapshots = Array.from(rowsByPeriod.entries())
    .map(([periodEndDate, rows]) => snapshotFromRows(ticker, periodEndDate, rows))
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => a.periodEndDate.localeCompare(b.periodEndDate));

  if (snapshots.length === 0) return [];

  return buildQuarterlyRecords(ticker, snapshots, annualRecord);
}

// ─── Level-3 cache: quarterly results per ticker (24 h TTL) ──────────────────
const QUARTERLY_TTL_MS = 24 * 60 * 60 * 1000;
const quarterlyCache = new Map<string, { data: QuarterlyFinancialRecord[]; loadedAt: number }>();
const quarterlyInflight = new Map<string, Promise<QuarterlyFinancialRecord[]>>();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches and normalizes quarterly ITR financials for a company.
 *
 * Three-level cache strategy mirrors dfp-client:
 *   L1  raw zip buffers  (1 h TTL) — one zip per year, shared across tickers
 *   L2  parsed rows      (24 h TTL) — per year × statement type × ticker
 *   L3  quarterly data   (24 h TTL) — per ticker
 *
 * annualFinancials (from the DFP pipeline) is used to derive Q4 records:
 *   Q4 = annual DFP value − Q3 cumulative ITR value.
 *
 * Year range defaults to CVM_ITR_START_YEAR–CVM_ITR_END_YEAR env vars
 * (2018–current year when not set).
 */
export async function getQuarterlyItrFinancials(
  ticker: string,
  cvmCode: string,
  annualFinancials: NormalizedFinancials[] = [],
  years?: readonly number[],
): Promise<QuarterlyFinancialRecord[]> {
  const key = `${ticker}:${cvmCode}`;

  const cached = quarterlyCache.get(key);
  if (cached && Date.now() - cached.loadedAt < QUARTERLY_TTL_MS) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[itr] ${ticker}: L3 cache hit`);
    }
    return cached.data;
  }

  const inflight = quarterlyInflight.get(key);
  if (inflight) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[itr] ${ticker}: joining in-flight pipeline`);
    }
    return inflight;
  }

  const startYear = parseInt(process.env.CVM_ITR_START_YEAR ?? String(DEFAULT_ITR_START_YEAR), 10);
  const endYear   = parseInt(process.env.CVM_ITR_END_YEAR   ?? String(new Date().getFullYear()), 10);
  const yearsToProcess = years ?? Array.from(
    { length: Math.max(0, endYear - startYear + 1) },
    (_, i) => startYear + i,
  );

  const p = (async () => {
    const t0 = Date.now();
    if (process.env.NODE_ENV === "development") {
      console.log(`[itr] ${ticker}: pipeline start — years [${yearsToProcess.join(",")}]`);
    }

    // Process years sequentially so that at most one ZIP's CSV strings are in
    // memory at a time. The L1 ZIP cache means each ZIP is downloaded only
    // once across all tickers sharing the same process (precompute script).
    const yearResults: QuarterlyFinancialRecord[][] = [];
    for (const year of yearsToProcess) {
      const annualForYear = annualFinancials.find(a => a.fiscalYear === year);
      yearResults.push(await processYear(year, ticker, cvmCode, annualForYear));
    }

    const data = yearResults
      .flat()
      .sort((a, b) =>
        a.fiscalYear !== b.fiscalYear
          ? a.fiscalYear - b.fiscalYear
          : a.quarter - b.quarter,
      );

    quarterlyCache.set(key, { data, loadedAt: Date.now() });

    if (process.env.NODE_ENV === "development") {
      console.log(`[itr] ${ticker}: done in ${Date.now() - t0}ms — ${data.length} quarterly records`);
    }

    return data;
  })();

  quarterlyInflight.set(key, p);
  p.finally(() => quarterlyInflight.delete(key));
  return p;
}
