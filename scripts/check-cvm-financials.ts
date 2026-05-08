/**
 * Development-only audit script: validates CVM DFP data availability for all
 * tickers with coverageStatus "cvm_financials" or "cvm_analysis".
 *
 * Usage:
 *   npx tsx scripts/check-cvm-financials.ts [options]
 *
 * Options:
 *   --url URL                Base URL of the running dev server (default: http://localhost:3000)
 *   --ticker TICKER          Audit a single ticker only
 *   --json                   Output results as JSON instead of a table
 *   --timeout-ms N           Fetch timeout in ms (default: 120000)
 *   --retries N              Retry count on timeout/connection failure (default: 2)
 *   --retry-delay-ms N       Delay between retries in ms (default: 1000)
 *   --debug                  Print per-attempt debug info to stderr
 *
 * Examples:
 *   npx tsx scripts/check-cvm-financials.ts
 *   npx tsx scripts/check-cvm-financials.ts --ticker PETR4
 *   npx tsx scripts/check-cvm-financials.ts --json > audit.json
 *   npx tsx scripts/check-cvm-financials.ts --url http://localhost:3001
 *   npx tsx scripts/check-cvm-financials.ts --ticker WEGE3 --debug
 *   npx tsx scripts/check-cvm-financials.ts --ticker WEGE3 --retries 3 --retry-delay-ms 1500
 *   npx tsx scripts/check-cvm-financials.ts --timeout-ms 180000
 *
 * This script is NOT imported by any production code. It does NOT affect the build.
 * Run with the dev server active: npm run dev
 */

// ─── Relative imports only (no @/ alias needed at runtime) ───────────────────

import { B3_UNIVERSE } from "../src/data/b3-universe";
import { getCvmCompanyByTicker } from "../src/lib/cvm/company-map";
import type { B3Asset } from "../src/data/b3-universe";
import type { CoverageStatus, AssetType } from "../src/data/coverage-types";

// ─── Inline types (avoid @/ alias for tsx runtime compatibility) ──────────────

interface NormalizedFinancials {
  ticker: string;
  fiscalYear: number;
  revenue?: number;
  ebit?: number;
  netIncome?: number;
  operatingCashFlow?: number;
  capex?: number;
  freeCashFlow?: number;
  cash?: number;
  totalDebt?: number;
  netDebt?: number;
}

interface ApiFinancialsResponse {
  ticker: string;
  source: string;
  error?: string;
  company?: {
    cvmCode?: string;
    companyName?: string;
  };
  financials: NormalizedFinancials[];
}

// ─── Eligibility logic (mirrored from cvm-analysis-builder.ts) ───────────────

const ANALYSIS_STATUSES: CoverageStatus[] = ["cvm_financials", "cvm_analysis"];
const ELIGIBLE_TYPES: AssetType[] = ["stock", "unit"];

function assetEligibilityReason(asset: B3Asset): string | null {
  if (asset.hasMockData)                                   return "has mock data";
  if (!ANALYSIS_STATUSES.includes(asset.coverageStatus))  return `status is ${asset.coverageStatus}`;
  if (!asset.hasCvmMapping)                                return "no CVM mapping";
  if (!ELIGIBLE_TYPES.includes(asset.assetType))           return `assetType is ${asset.assetType}`;
  return null;
}

function dataEligibilityReason(financials: NormalizedFinancials[]): string | null {
  if (financials.length < 3) return `only ${financials.length} year(s) of data`;

  const latest = [...financials].sort((a, b) => b.fiscalYear - a.fiscalYear)[0];

  if (latest.revenue === undefined) return "latest revenue missing";
  if (latest.revenue <= 0)          return "latest revenue <= 0";

  // All non-revenue key fields are zero or absent — data looks malformed
  const otherMetrics = [
    latest.ebit, latest.netIncome, latest.operatingCashFlow,
    latest.capex, latest.freeCashFlow, latest.netDebt,
  ];
  if (otherMetrics.every(v => v === undefined || v === 0)) {
    return "all latest metrics are zero";
  }

  // At least one income/CF metric must be non-zero for CVM analysis
  const hasUsable =
    (latest.ebit              !== undefined && latest.ebit              !== 0) ||
    (latest.netIncome         !== undefined && latest.netIncome         !== 0) ||
    (latest.operatingCashFlow !== undefined && latest.operatingCashFlow !== 0) ||
    (latest.freeCashFlow      !== undefined && latest.freeCashFlow      !== 0);

  if (!hasUsable) return "no usable income/cash-flow metric";

  return null;
}

// ─── CLI args ─────────────────────────────────────────────────────────────────

interface ParsedArgs {
  baseUrl:      string;
  singleTicker: string | null;
  json:         boolean;
  timeoutMs:    number;
  retries:      number;
  retryDelayMs: number;
  debug:        boolean;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let baseUrl      = "http://localhost:3000";
  let singleTicker: string | null = null;
  let json         = false;
  let timeoutMs    = 120_000;
  let retries      = 2;
  let retryDelayMs = 1_000;
  let debug        = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--url"            && args[i + 1]) { baseUrl      = args[++i]; continue; }
    if (args[i] === "--ticker"         && args[i + 1]) { singleTicker = args[++i].toUpperCase(); continue; }
    if (args[i] === "--json")                          { json         = true; continue; }
    if (args[i] === "--timeout-ms"     && args[i + 1]) { timeoutMs    = parseInt(args[++i], 10); continue; }
    if (args[i] === "--retries"        && args[i + 1]) { retries      = parseInt(args[++i], 10); continue; }
    if (args[i] === "--retry-delay-ms" && args[i + 1]) { retryDelayMs = parseInt(args[++i], 10); continue; }
    if (args[i] === "--debug")                         { debug        = true; continue; }
    // Legacy: bare URL as first positional argument
    if (!args[i].startsWith("--") && i === 0)          { baseUrl = args[i]; }
  }

  return { baseUrl, singleTicker, json, timeoutMs, retries, retryDelayMs, debug };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function debugLog(line: string): void {
  process.stderr.write(`[debug] ${line}\n`);
}

// ─── API fetch with retry ─────────────────────────────────────────────────────

interface FetchOpts {
  timeoutMs:    number;
  retries:      number;
  retryDelayMs: number;
  debug:        boolean;
}

interface FetchResult {
  data:              ApiFinancialsResponse | null;
  error:             string | null;
  attempts:          number;
  finalErrorMessage: string | null;
}

async function fetchFinancials(
  ticker: string,
  baseUrl: string,
  opts: FetchOpts,
): Promise<FetchResult> {
  const { timeoutMs, retries, retryDelayMs, debug } = opts;
  const maxAttempts = retries + 1;
  const url = `${baseUrl}/api/cvm/financials/${ticker}`;

  let lastErrorName = "";
  let lastErrorMsg  = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const willRetry = attempt < maxAttempts;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });

      if (!res.ok) {
        const errMsg = `HTTP ${res.status}`;
        if (debug) {
          debugLog(
            `${ticker} attempt ${attempt}/${maxAttempts} url=${url} timeoutMs=${timeoutMs}` +
            ` errorName=HttpError errorMsg=${errMsg} retrying=false finalResult=${errMsg}`,
          );
        }
        return { data: null, error: errMsg, attempts: attempt, finalErrorMessage: errMsg };
      }

      const body = (await res.json()) as ApiFinancialsResponse;
      if (debug) {
        debugLog(
          `${ticker} attempt ${attempt}/${maxAttempts} url=${url} timeoutMs=${timeoutMs}` +
          ` finalResult=success`,
        );
      }
      return { data: body, error: body.error ?? null, attempts: attempt, finalErrorMessage: null };

    } catch (err: unknown) {
      const e       = err instanceof Error ? err : null;
      lastErrorName = e?.name    ?? "UnknownError";
      lastErrorMsg  = e?.message ?? String(err);

      if (debug) {
        debugLog(
          `${ticker} attempt ${attempt}/${maxAttempts} url=${url} timeoutMs=${timeoutMs}` +
          ` errorName=${lastErrorName} errorMsg=${lastErrorMsg} retrying=${willRetry}`,
        );
      }

      if (willRetry && retryDelayMs > 0) await sleep(retryDelayMs);
    }
  }

  // All attempts exhausted — build descriptive error
  const isConnRefused = lastErrorMsg.includes("ECONNREFUSED");
  const isTimeout     = lastErrorName === "TimeoutError" || lastErrorMsg.toLowerCase().includes("timeout");

  let finalErrorMessage: string;
  if (isConnRefused) {
    finalErrorMessage = "server not running";
  } else if (isTimeout) {
    finalErrorMessage = `timeout after ${timeoutMs}ms after ${maxAttempts} attempt(s)`;
  } else {
    finalErrorMessage = `fetch failed after ${maxAttempts} attempt(s): ${lastErrorMsg}`;
  }

  if (debug) debugLog(`${ticker} final: ${finalErrorMessage}`);

  return { data: null, error: finalErrorMessage, attempts: maxAttempts, finalErrorMessage };
}

// ─── Audit row ────────────────────────────────────────────────────────────────

interface AuditRow {
  ticker:            string;
  tradingName:       string;
  companyName:       string;
  coverageStatus:    CoverageStatus;
  hasCvmMapping:     boolean;
  cvmCode:           string | null;
  // API results
  fetchError:        string | null;
  yearsReturned:     number;
  latestYear:        number | null;
  revenue:           number | null;
  ebit:              number | null;
  netIncome:         number | null;
  ocf:               number | null;
  capex:             number | null;
  fcf:               number | null;
  netDebt:           number | null;
  // Eligibility
  assetEligible:     boolean;
  assetReason:       string | null;
  dataEligible:      boolean;
  dataReason:        string | null;
  overallEligible:   boolean;
  eligibleReason:    string | null;
  // Fetch metadata
  attempts:          number;
  timeoutMs:         number;
  retries:           number;
  finalErrorMessage: string | null;
}

async function auditTicker(asset: B3Asset, baseUrl: string, opts: FetchOpts): Promise<AuditRow> {
  const cvmEntry  = getCvmCompanyByTicker(asset.ticker);
  const cvmCode   = cvmEntry?.cvmCode ?? null;

  const assetReason   = assetEligibilityReason(asset);
  const assetEligible = assetReason === null;

  let fetchError: string | null = null;
  let years: NormalizedFinancials[] = [];
  let latestYear: number | null = null;
  let revenue:    number | null = null;
  let ebit:       number | null = null;
  let netIncome:  number | null = null;
  let ocf:        number | null = null;
  let capex:      number | null = null;
  let fcf:        number | null = null;
  let netDebt:    number | null = null;

  const { data, error, attempts, finalErrorMessage } = await fetchFinancials(asset.ticker, baseUrl, opts);
  fetchError = error;

  if (data && Array.isArray(data.financials)) {
    years = data.financials;
    if (years.length > 0) {
      const latest = [...years].sort((a, b) => b.fiscalYear - a.fiscalYear)[0];
      latestYear = latest.fiscalYear;
      revenue    = latest.revenue           ?? null;
      ebit       = latest.ebit              ?? null;
      netIncome  = latest.netIncome         ?? null;
      ocf        = latest.operatingCashFlow ?? null;
      capex      = latest.capex             ?? null;
      fcf        = latest.freeCashFlow      ?? null;
      netDebt    = latest.netDebt           ?? null;
    }
  }

  const dataReason = dataEligibilityReason(years);
  const dataEl     = dataReason === null;
  const overallEl  = assetEligible && dataEl;
  const eligibleReason: string | null = !assetEligible
    ? assetReason
    : !dataEl
    ? dataReason
    : null;

  return {
    ticker:          asset.ticker,
    tradingName:     asset.tradingName,
    companyName:     asset.companyName,
    coverageStatus:  asset.coverageStatus,
    hasCvmMapping:   asset.hasCvmMapping,
    cvmCode,
    fetchError,
    yearsReturned:   years.length,
    latestYear,
    revenue,
    ebit,
    netIncome,
    ocf,
    capex,
    fcf,
    netDebt,
    assetEligible,
    assetReason,
    dataEligible:    dataEl,
    dataReason,
    overallEligible: overallEl,
    eligibleReason,
    attempts,
    timeoutMs:       opts.timeoutMs,
    retries:         opts.retries,
    finalErrorMessage,
  };
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtB(v: number | null): string {
  if (v === null) return "—";
  return v.toFixed(1);
}

function padL(s: string, w: number): string { return s.padStart(w); }
function padR(s: string, w: number): string { return s.padEnd(w);   }

const RESET  = "\x1b[0m";
const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM    = "\x1b[2m";
const BOLD   = "\x1b[1m";

function colored(s: string, code: string): string {
  return process.stdout.isTTY ? `${code}${s}${RESET}` : s;
}

// ─── Table output ─────────────────────────────────────────────────────────────

function printTable(rows: AuditRow[]): void {
  //            TICKER  NAME             ST   MAP  CODE   YRS YEAR  REV.B   EBIT.B  NI.B   OCF.B   CAP.B   FCF.B   ND.B   EL  REASON
  const H = `${"TICKER".padEnd(7)}  ${"NAME".padEnd(16)}  ${"ST".padEnd(3)}  ${"MAP".padEnd(3)}  ${"CODE".padEnd(6)}  ${"YRS".padStart(3)}  ${"YEAR".padStart(4)}  ${"REV.B".padStart(7)}  ${"EBIT.B".padStart(7)}  ${"NI.B".padStart(7)}  ${"OCF.B".padStart(7)}  ${"CAP.B".padStart(6)}  ${"FCF.B".padStart(7)}  ${"ND.B".padStart(7)}  EL  REASON`;
  const SEP = "─".repeat(H.length + 2);

  console.log();
  console.log(colored(H, BOLD));
  console.log(SEP);

  for (const r of rows) {
    const st   = r.coverageStatus === "cvm_financials" ? "cvm"
               : r.coverageStatus === "cvm_analysis"   ? "ana"
               : "oth";
    const map  = r.hasCvmMapping ? "Y" : "N";
    const code = r.cvmCode ?? "—";
    const yrs  = r.yearsReturned > 0 ? String(r.yearsReturned) : "—";
    const yr   = r.latestYear    ? String(r.latestYear)    : "—";

    let el: string;
    if (r.fetchError) {
      el = colored("ERR", YELLOW);
    } else if (r.overallEligible) {
      el = colored("✓", GREEN);
    } else {
      el = colored("✗", RED);
    }

    const reason = r.fetchError
      ? (r.fetchError.length > 50 ? r.fetchError.slice(0, 47) + "…" : r.fetchError)
      : r.eligibleReason ?? "";

    const name = r.tradingName.length > 16 ? r.tradingName.slice(0, 15) + "…" : r.tradingName;

    console.log(
      `${padR(r.ticker, 7)}  ${padR(name, 16)}  ${padR(st, 3)}  ${padR(map, 3)}  ${padR(code, 6)}  ` +
      `${padL(yrs, 3)}  ${padL(yr, 4)}  ` +
      `${padL(fmtB(r.revenue), 7)}  ${padL(fmtB(r.ebit), 7)}  ${padL(fmtB(r.netIncome), 7)}  ` +
      `${padL(fmtB(r.ocf), 7)}  ${padL(fmtB(r.capex), 6)}  ${padL(fmtB(r.fcf), 7)}  ${padL(fmtB(r.netDebt), 7)}  ` +
      `${el.padEnd(2)}  ${reason}`,
    );
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

interface Summary {
  totalChecked:       number;
  withCvmMapping:     number;
  withAnyData:        number;
  withThreePlusYears: number;
  eligible:           number;
  notEligible:        number;
  errors:             number;
}

function buildSummary(rows: AuditRow[]): Summary {
  return {
    totalChecked:       rows.length,
    withCvmMapping:     rows.filter(r => r.hasCvmMapping).length,
    withAnyData:        rows.filter(r => r.yearsReturned > 0).length,
    withThreePlusYears: rows.filter(r => r.yearsReturned >= 3).length,
    eligible:           rows.filter(r => r.overallEligible).length,
    notEligible:        rows.filter(r => !r.overallEligible && !r.fetchError && ANALYSIS_STATUSES.includes(r.coverageStatus)).length,
    errors:             rows.filter(r => r.fetchError !== null).length,
  };
}

function printSummary(summary: Summary): void {
  console.log();
  console.log(colored("── Summary ──────────────────────────────────", BOLD));
  console.log(`  Total checked          : ${summary.totalChecked}`);
  console.log(`  With CVM mapping       : ${summary.withCvmMapping}`);
  console.log(`  With any data returned : ${summary.withAnyData}`);
  console.log(`  With ≥ 3 years         : ${summary.withThreePlusYears}`);
  console.log(`  Eligible for analysis  : ${colored(String(summary.eligible), GREEN)}`);
  console.log(`  Not eligible           : ${colored(String(summary.notEligible), RED)}`);
  console.log(`  Fetch errors           : ${summary.errors > 0 ? colored(String(summary.errors), YELLOW) : "0"}`);
  console.log();
}

// ─── Ineligible detail block ──────────────────────────────────────────────────

function printIneligibleDetail(rows: AuditRow[]): void {
  const ineligible = rows.filter(
    r => !r.overallEligible && !r.fetchError && ANALYSIS_STATUSES.includes(r.coverageStatus),
  );
  if (ineligible.length === 0) return;

  console.log(colored("── Not eligible (cvm_financials / cvm_analysis) ───────────", BOLD));
  for (const r of ineligible) {
    const reason = r.eligibleReason ?? "unknown";
    console.log(`  ${padR(r.ticker, 7)}  ${colored(reason, RED)}`);
  }
  console.log();
}

// ─── JSON output ──────────────────────────────────────────────────────────────

function outputJson(rows: AuditRow[], summary: Summary): void {
  const output = {
    generatedAt: new Date().toISOString(),
    summary,
    rows: rows.map(r => ({
      ticker:            r.ticker,
      tradingName:       r.tradingName,
      companyName:       r.companyName,
      coverageStatus:    r.coverageStatus,
      hasCvmMapping:     r.hasCvmMapping,
      cvmCode:           r.cvmCode,
      fetchError:        r.fetchError,
      yearsReturned:     r.yearsReturned,
      latestYear:        r.latestYear,
      latestRevenue:     r.revenue,
      latestEbit:        r.ebit,
      latestNetIncome:   r.netIncome,
      latestOcf:         r.ocf,
      latestCapex:       r.capex,
      latestFcf:         r.fcf,
      latestNetDebt:     r.netDebt,
      assetEligible:     r.assetEligible,
      assetReason:       r.assetReason,
      dataEligible:      r.dataEligible,
      dataReason:        r.dataReason,
      overallEligible:   r.overallEligible,
      eligibleReason:    r.eligibleReason,
      attempts:          r.attempts,
      timeoutMs:         r.timeoutMs,
      retries:           r.retries,
      finalErrorMessage: r.finalErrorMessage,
    })),
  };
  console.log(JSON.stringify(output, null, 2));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { baseUrl, singleTicker, json, timeoutMs, retries, retryDelayMs, debug } = parseArgs();
  const fetchOpts: FetchOpts = { timeoutMs, retries, retryDelayMs, debug };

  const TARGET_STATUSES: CoverageStatus[] = ["cvm_financials", "cvm_analysis"];

  let assets = B3_UNIVERSE.filter(a => TARGET_STATUSES.includes(a.coverageStatus));

  if (singleTicker) {
    const found = assets.find(a => a.ticker === singleTicker);
    if (!found) {
      console.error(`Ticker ${singleTicker} not found or not in cvm_financials/cvm_analysis.`);
      process.exit(1);
    }
    assets = [found];
  }

  if (!json) {
    console.log();
    console.log(colored("CVM Financials Audit", BOLD));
    console.log(`Base URL   : ${baseUrl}`);
    console.log(`Checking   : ${assets.length} ticker(s)`);
    console.log(`Timeout    : ${timeoutMs}ms  Retries: ${retries}  RetryDelay: ${retryDelayMs}ms`);
    console.log(`Statuses   : cvm_financials + cvm_analysis`);
    console.log(
      `Note       : All monetary values in BRL billions (R$B). ` +
      `Eligibility = CVM analysis readiness check.`,
    );
  }

  // Sequential fetch to avoid hammering the dev server
  const rows: AuditRow[] = [];
  for (const asset of assets) {
    if (!json) process.stdout.write(`  Fetching ${asset.ticker}…\r`);
    const row = await auditTicker(asset, baseUrl, fetchOpts);
    rows.push(row);
  }

  if (!json) process.stdout.write(" ".repeat(40) + "\r");

  const summary = buildSummary(rows);

  if (json) {
    outputJson(rows, summary);
    return;
  }

  printTable(rows);
  printSummary(summary);
  printIneligibleDetail(rows);
}

main().catch(err => {
  console.error("Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
