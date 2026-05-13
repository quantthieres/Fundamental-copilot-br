/**
 * Precomputes CVM ITR quarterly financial data for all covered tickers and
 * writes static JSON cache files to src/data/cvm-cache/quarterly/.
 *
 * Usage:
 *   npm run cvm:precompute:quarterly
 *
 * Files written:
 *   src/data/cvm-cache/quarterly/<TICKER>.json
 *
 * Covers all B3 tickers with:
 *   - hasCvmMapping: true
 *   - coverageStatus in { full_analysis, cvm_analysis, cvm_financials }
 *
 * Environment overrides:
 *   CVM_ITR_START_YEAR  (default 2018)
 *   CVM_ITR_END_YEAR    (default current year)
 *
 * Memory strategy — year-first batch processing:
 *   For each year, one ITR ZIP is downloaded (~33 MB), all companies' rows are
 *   extracted from it in a single CSV pass, then the ZIP buffer is released.
 *   Peak memory: ~1 ZIP buffer + ~1 decompressed CSV string (~100 MB) = ~200 MB.
 *   This avoids accumulating multiple large ZIP buffers simultaneously.
 *
 * Does NOT import @/ aliases — uses relative paths for tsx runtime compatibility.
 */

import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { unzipSync } from "fflate";

import { B3_UNIVERSE } from "../src/data/b3-universe";
import { getCvmCompanyByTicker } from "../src/lib/cvm/company-map";
import { fetchItrYearZip, clearItrZipCache } from "../src/lib/cvm/itr-client";
import { parseDfpCsvForCompanies } from "../src/lib/cvm/dfp-parser";
import { snapshotFromRows, buildQuarterlyRecords } from "../src/lib/cvm/itr-quarterly";
import type { CoverageStatus } from "../src/data/coverage-types";
import type { NormalizedFinancials, RawCvmStatementRow, QuarterlyFinancialRecord } from "../src/lib/cvm/types";

// ─── Config ───────────────────────────────────────────────────────────────────

const CACHE_ROOT = join(process.cwd(), "src/data/cvm-cache");

const ELIGIBLE_STATUSES = new Set<CoverageStatus>([
  "full_analysis",
  "cvm_analysis",
  "cvm_financials",
]);

const STATEMENT_TYPES = [
  "DRE_con",
  "BPA_con",
  "BPP_con",
  "DFC_MI_con",
  "DFC_MD_con",
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadAnnualFinancials(ticker: string): NormalizedFinancials[] {
  try {
    const raw = readFileSync(join(CACHE_ROOT, "financials", `${ticker}.json`), "utf-8");
    const parsed = JSON.parse(raw) as { financials?: NormalizedFinancials[] };
    return Array.isArray(parsed.financials) ? parsed.financials : [];
  } catch {
    return [];
  }
}

// ─── Year-first batch row extraction ─────────────────────────────────────────

/**
 * Downloads one ITR year ZIP, extracts all 5 statement types, parses rows for
 * all target companies in a single CSV pass per statement, then clears the ZIP
 * from memory. Returns rows accumulated by (cvmCode → RawCvmStatementRow[]).
 */
async function extractYearRowsForAll(
  year: number,
  cvmCodeSet: Set<string>,
): Promise<Map<string, RawCvmStatementRow[]>> {
  const accumulated = new Map<string, RawCvmStatementRow[]>();

  const zip = await fetchItrYearZip(year);
  if (!zip) return accumulated;

  for (const stmtType of STATEMENT_TYPES) {
    const filename = `itr_cia_aberta_${stmtType}_${year}.csv`;
    let extracted: { [key: string]: Uint8Array };
    try {
      extracted = unzipSync(zip, { filter: (f) => f.name === filename });
    } catch {
      continue;
    }

    const fileBytes = extracted[filename];
    if (!fileBytes) continue;

    const text = new TextDecoder("latin1").decode(fileBytes);
    const stmtLabel = stmtType.replace(/_con$/, "");
    const byCompany = parseDfpCsvForCompanies(text, cvmCodeSet, stmtLabel);

    // Merge into the per-company accumulator.
    for (const [code, rows] of byCompany) {
      let existing = accumulated.get(code);
      if (!existing) {
        existing = [];
        accumulated.set(code, existing);
      }
      existing.push(...rows);
    }
    // text and fileBytes are now out of scope → eligible for GC.
  }

  // Release this year's ZIP buffer from the L1 cache immediately.
  clearItrZipCache();

  return accumulated;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  mkdirSync(join(CACHE_ROOT, "quarterly"), { recursive: true });

  const companies = B3_UNIVERSE
    .filter(a => a.hasCvmMapping && ELIGIBLE_STATUSES.has(a.coverageStatus))
    .map(a => {
      const cvm = getCvmCompanyByTicker(a.ticker);
      return cvm && cvm.hasCvmMapping && cvm.cvmCode
        ? { ticker: a.ticker, cvmCode: cvm.cvmCode, companyName: cvm.companyName }
        : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const cvmCodeSet = new Set(companies.map(c => c.cvmCode));

  const startYear = parseInt(process.env.CVM_ITR_START_YEAR ?? "2018", 10);
  const endYear   = parseInt(process.env.CVM_ITR_END_YEAR   ?? String(new Date().getFullYear()), 10);
  const years: number[] = Array.from(
    { length: Math.max(0, endYear - startYear + 1) },
    (_, i) => startYear + i,
  );

  console.log(
    `\nPrecomputing CVM ITR quarterly cache for ${companies.length} tickers`,
    `(years ${startYear}–${endYear}, year-first batch strategy)...\n`,
  );

  const t0 = Date.now();

  // ── Phase 1: extract rows for all companies, year by year ─────────────────
  // rowsByCompany[cvmCode] accumulates rows across ALL years.
  const rowsByCompany = new Map<string, RawCvmStatementRow[]>();

  for (const year of years) {
    process.stdout.write(`  Year ${year}: downloading...`);
    const yearRows = await extractYearRowsForAll(year, cvmCodeSet);
    let totalRows = 0;
    for (const [code, rows] of yearRows) {
      let existing = rowsByCompany.get(code);
      if (!existing) {
        existing = [];
        rowsByCompany.set(code, existing);
      }
      existing.push(...rows);
      totalRows += rows.length;
    }
    console.log(`\r  Year ${year}: ${totalRows} rows extracted (${yearRows.size} companies)    `);
  }

  // ── Phase 2: build quarterly records per ticker ───────────────────────────
  console.log("\n  Building quarterly records...\n");

  let ok = 0;
  let empty = 0;
  let errors = 0;
  let totalQuarters = 0;

  for (const { ticker, cvmCode, companyName } of companies) {
    try {
      // parseDfpCsvForCompanies pads codes to 6 digits; match that key.
      const paddedCode = cvmCode.padStart(6, "0");
      const allRows = rowsByCompany.get(paddedCode) ?? [];

      // Group rows by periodEndDate, then build cumulative snapshots.
      const rowsByPeriod = new Map<string, RawCvmStatementRow[]>();
      for (const row of allRows) {
        let bucket = rowsByPeriod.get(row.periodEndDate);
        if (!bucket) {
          bucket = [];
          rowsByPeriod.set(row.periodEndDate, bucket);
        }
        bucket.push(row);
      }

      // Build snapshots for each quarter period.
      const snapshots = Array.from(rowsByPeriod.entries())
        .map(([periodEndDate, rows]) => snapshotFromRows(ticker, periodEndDate, rows))
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .sort((a, b) => a.periodEndDate.localeCompare(b.periodEndDate));

      if (snapshots.length === 0) {
        const outPath = join(CACHE_ROOT, "quarterly", `${ticker}.json`);
        writeFileSync(
          outPath,
          JSON.stringify({ ticker, companyName, generatedAt: new Date().toISOString(), quarterly: [] }, null, 2),
          "utf-8",
        );
        console.log(`  [${ticker}] EMPTY`);
        empty++;
        continue;
      }

      // Group snapshots by fiscal year and build quarterly records, deriving Q4
      // from annual DFP when available.
      const annualFinancials = loadAnnualFinancials(ticker);

      // Group snapshots by fiscal year for proper Q4 derivation.
      const byFiscalYear = new Map<number, typeof snapshots>();
      for (const s of snapshots) {
        let group = byFiscalYear.get(s.fiscalYear);
        if (!group) {
          group = [];
          byFiscalYear.set(s.fiscalYear, group);
        }
        group.push(s);
      }

      const quarterly: QuarterlyFinancialRecord[] = [];
      for (const [fy, fySnapshots] of byFiscalYear) {
        const annualRecord = annualFinancials.find(a => a.fiscalYear === fy);
        quarterly.push(...buildQuarterlyRecords(ticker, fySnapshots, annualRecord));
      }
      quarterly.sort((a, b) =>
        a.fiscalYear !== b.fiscalYear ? a.fiscalYear - b.fiscalYear : a.quarter - b.quarter,
      );

      const outPath = join(CACHE_ROOT, "quarterly", `${ticker}.json`);
      writeFileSync(
        outPath,
        JSON.stringify({ ticker, companyName, generatedAt: new Date().toISOString(), quarterly }, null, 2),
        "utf-8",
      );

      totalQuarters += quarterly.length;
      console.log(`  [${ticker}] OK (${quarterly.length} quarters)`);
      ok++;
    } catch (err) {
      console.log(`  [${ticker}] ERROR — ${err instanceof Error ? err.message : String(err)}`);
      errors++;
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────");
  console.log(`  Total tickers:   ${companies.length}`);
  console.log(`  OK:              ${ok}`);
  console.log(`  Empty:           ${empty}`);
  console.log(`  Error:           ${errors}`);
  console.log(`  Total quarters:  ${totalQuarters}`);
  console.log(`  Elapsed:         ${elapsed}s`);
  console.log("─────────────────────────────────────────\n");

  if (errors > 0) process.exit(1);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
