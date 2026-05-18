/**
 * Precomputes bank DFP analysis for all B3 bank tickers and writes cache files
 * to src/data/bank-cache/annual/<TICKER>.json.
 *
 * Usage:
 *   npm run bank:precompute
 *   BANK_PRECOMPUTE_TICKERS=ITUB4,BBAS3 npm run bank:precompute   # subset
 *   BANK_PRECOMPUTE_CONCURRENCY=1 npm run bank:precompute          # serial
 *
 * Does NOT modify any industrial CVM caches.
 * Does NOT import @/ aliases — uses relative paths for tsx runtime compatibility.
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { unzipSync } from "fflate";

import { B3_UNIVERSE } from "../src/data/b3-universe";
import { classifyAsset } from "../src/lib/coverage/asset-classifier";
import { parseDfpCsv } from "../src/lib/cvm/dfp-parser";
import { normalizeBankRows } from "../src/lib/banks/bank-normalizer";
import { computeBankIndicators } from "../src/lib/banks/bank-indicators";
import type { BankAnalysisResponse, BankFinancialRecord } from "../src/lib/banks/bank-types";
import type { RawCvmStatementRow } from "../src/lib/cvm/types";

// ─── Config ───────────────────────────────────────────────────────────────────

const CONCURRENCY  = Number(process.env.BANK_PRECOMPUTE_CONCURRENCY ?? process.env.CVM_CONCURRENCY ?? 2);
const DFP_BASE     = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/DFP/DADOS";
const REGISTRY_URL = "https://dados.cvm.gov.br/dados/CIA_ABERTA/CAD/DADOS/cad_cia_aberta.csv";
const CACHE_DIR    = join(process.cwd(), "src/data/bank-cache/annual");
const DFP_YEARS    = [2020, 2021, 2022, 2023, 2024] as const;

const STATEMENT_TYPES = ["DRE_con", "BPA_con", "BPP_con"] as const;

// Manual CVM code overrides — required when registry name-matching cannot
// unambiguously identify the active company (e.g. BRSR6 whose registry name
// is "BANCO DO ESTADO DO RIO GRANDE DO SUL SA", not "Banrisul").
const CVM_CODE_OVERRIDES: Record<string, string> = {
  BRSR6: "1210", // Banco do Estado do Rio Grande do Sul SA
};

// ─── Registry lookup ──────────────────────────────────────────────────────────

interface RegistryEntry {
  cvmCode: string;
  companyName: string;
  tradingName?: string;
  cnpj: string;
  status: string;
}

function normaReg(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[.\-/—–()]/g, " ")   // strip punctuation incl. parentheses
    .replace(/\bS\.?\s*A\.?\b/g, "")
    .replace(/\bCIA\.?\b/g, "")
    .replace(/\bCOMPANHIA\b/g, "")
    .replace(/\bLTDA\.?\b/g, "")
    .replace(/\s+/g, " ").trim();
}

async function fetchRegistry(): Promise<RegistryEntry[]> {
  console.log("  Fetching CVM registry...");
  const res = await fetch(REGISTRY_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Registry fetch failed: ${res.status}`);

  const buffer = await res.arrayBuffer();
  const text = new TextDecoder("latin1").decode(buffer);
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(";");
  const idx = {
    cnpj:      headers.indexOf("CNPJ_CIA"),
    social:    headers.indexOf("DENOM_SOCIAL"),
    comercial: headers.indexOf("DENOM_COMERC"),
    cvmCode:   headers.indexOf("CD_CVM"),
    status:    headers.indexOf("SIT"),
  };

  const results: RegistryEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(";");
    const cvmCode   = cols[idx.cvmCode]?.trim();
    const cnpj      = cols[idx.cnpj]?.trim();
    const social    = cols[idx.social]?.trim();
    const comercial = cols[idx.comercial]?.trim() || undefined;
    const status    = cols[idx.status]?.trim() ?? "";
    if (!cvmCode || !cnpj || !social) continue;
    results.push({ cvmCode, cnpj, companyName: social, tradingName: comercial, status });
  }
  console.log(`  Registry loaded: ${results.length} entries (active only for matching)`);
  return results;
}

function findCvmCode(ticker: string, companyName: string, registry: RegistryEntry[]): string | null {
  if (CVM_CODE_OVERRIDES[ticker]) return CVM_CODE_OVERRIDES[ticker];

  const target = normaReg(companyName);
  // Only consider ATIVO companies — prevents matching cancelled predecessors
  // that share the same name (e.g. old Itaú Unibanco entities).
  const active = registry.filter(e => e.status === "ATIVO");

  // Pass 1: exact match on normalized name
  for (const entry of active) {
    const names = [normaReg(entry.companyName), normaReg(entry.tradingName ?? "")].filter(Boolean);
    if (names.some(n => n === target)) return entry.cvmCode;
  }

  // Pass 2: all target words (≥3 chars) present in registry name
  const targetWords = target.split(" ").filter(w => w.length >= 3);
  if (targetWords.length >= 2) {
    for (const entry of active) {
      const names = [normaReg(entry.companyName), normaReg(entry.tradingName ?? "")].filter(Boolean);
      if (names.some(n => targetWords.every(w => n.includes(w)))) {
        return entry.cvmCode;
      }
    }
  }

  return null;
}

// ─── DFP fetch ────────────────────────────────────────────────────────────────

const zipCache = new Map<number, Uint8Array>();

async function getZip(year: number): Promise<Uint8Array | null> {
  const cached = zipCache.get(year);
  if (cached) return cached;

  const url = `${DFP_BASE}/dfp_cia_aberta_${year}.zip`;
  process.stdout.write(`    Downloading DFP ${year}...`);
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) { process.stdout.write(` SKIP (${res.status})\n`); return null; }
    const buf = new Uint8Array(await res.arrayBuffer());
    zipCache.set(year, buf);
    process.stdout.write(` OK (${(buf.length / 1024 / 1024).toFixed(1)} MB)\n`);
    return buf;
  } catch (err) {
    process.stdout.write(` ERROR: ${err instanceof Error ? err.message : String(err)}\n`);
    return null;
  }
}

async function getRawRows(year: number, cvmCode: string): Promise<RawCvmStatementRow[]> {
  const zip = await getZip(year);
  if (!zip) return [];

  const allRows: RawCvmStatementRow[] = [];
  for (const stmtType of STATEMENT_TYPES) {
    const filename = `dfp_cia_aberta_${stmtType}_${year}.csv`;
    let extracted: Record<string, Uint8Array>;
    try {
      extracted = unzipSync(zip, { filter: (f: {name: string}) => f.name === filename });
    } catch { continue; }

    const fileBytes = extracted[filename];
    if (!fileBytes) continue;

    const text  = new TextDecoder("latin1").decode(fileBytes);
    const label = stmtType.replace("_con", "");
    const rows  = parseDfpCsv(text, cvmCode, label);
    allRows.push(...rows);
  }
  return allRows;
}

// ─── Quality checks ───────────────────────────────────────────────────────────

function buildQualityWarnings(annual: BankFinancialRecord[]): string[] {
  const warnings: string[] = [];
  for (const r of annual) {
    if (r.equity !== null && r.totalAssets !== null && r.totalAssets > 0) {
      const ratio = r.equity / r.totalAssets;
      if (ratio < 0.04) {
        warnings.push(`${r.fiscalYear}: índice PL/Ativos implausível (${(ratio * 100).toFixed(1)}%) — verificar extração de patrimônio.`);
      }
      if (ratio > 0.60) {
        warnings.push(`${r.fiscalYear}: PL/Ativos muito elevado (${(ratio * 100).toFixed(1)}%) — verificar extração de patrimônio.`);
      }
    }
    if (r.netIncome !== null && r.equity !== null && r.equity > 0) {
      const roe = r.netIncome / r.equity;
      if (roe > 0.80) {
        warnings.push(`${r.fiscalYear}: ROE implausível (${(roe * 100).toFixed(1)}%) — possível erro na extração de PL.`);
      }
    }
  }
  return warnings;
}

// ─── Per-ticker processing ────────────────────────────────────────────────────

interface TickerResult {
  ticker: string;
  status: "ok" | "no_cvm_code" | "no_data" | "error";
  yearsFound: number;
  error?: string;
}

async function processTicker(
  ticker: string,
  companyName: string,
  registry: RegistryEntry[],
): Promise<TickerResult> {
  const cvmCode = findCvmCode(ticker, companyName, registry);
  if (!cvmCode) {
    return { ticker, status: "no_cvm_code", yearsFound: 0, error: "CVM code not found in registry" };
  }

  console.log(`  [${ticker}] CVM code: ${cvmCode}`);

  const annual: BankFinancialRecord[] = [];
  const fetchWarnings: string[] = [];

  for (const year of DFP_YEARS) {
    try {
      const rows = await getRawRows(year, cvmCode);
      if (rows.length === 0) continue;

      const periodEnd  = rows[0].periodEndDate;
      const fiscalYear = new Date(periodEnd).getFullYear();
      const record     = normalizeBankRows(ticker, fiscalYear, periodEnd, rows);

      if (record.totalAssets !== null || record.equity !== null || record.netIncome !== null) {
        const existingIdx = annual.findIndex(r => r.fiscalYear === fiscalYear);
        if (existingIdx >= 0) {
          annual[existingIdx] = record;
        } else {
          annual.push(record);
        }
      }
    } catch (err) {
      fetchWarnings.push(`${year}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  annual.sort((a, b) => a.fiscalYear - b.fiscalYear);

  if (annual.length === 0) {
    return { ticker, status: "no_data", yearsFound: 0, error: "No bank financials extracted" };
  }

  const indicators    = computeBankIndicators(annual);
  const qualityWarnings = buildQualityWarnings(annual);
  const warnings      = [...fetchWarnings, ...qualityWarnings];

  const response: BankAnalysisResponse = {
    ticker,
    source: "bank_analysis",
    sourceDetail: "bank_cvm_cache",
    available: true,
    company: { ticker, companyName, cvmCode },
    annual,
    indicators,
    updatedAt: new Date().toISOString(),
    warnings,
  };

  const outPath = join(CACHE_DIR, `${ticker}.json`);
  writeFileSync(outPath, JSON.stringify(response, null, 2), "utf-8");

  return { ticker, status: "ok", yearsFound: annual.length };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;
  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  mkdirSync(CACHE_DIR, { recursive: true });

  // Only process tickers classified as "bank" — excludes ITSA4 (financial holding)
  // and avoids processing both ITUB4+ITUB3 for the same company.
  const allBankAssets = B3_UNIVERSE.filter(a => {
    const richType = classifyAsset(a.ticker, {
      b3AssetType: a.assetType,
      sector:      a.sector,
      companyName: a.companyName,
    });
    return richType === "bank";
  });

  // Deduplicate by companyName (ITUB4 and ITUB3 share the same company).
  const seen = new Set<string>();
  const uniqueBanks = allBankAssets.filter(a => {
    if (seen.has(a.companyName)) return false;
    seen.add(a.companyName);
    return true;
  });

  // Optional: restrict to specific tickers via env var.
  const tickerFilter = process.env.BANK_PRECOMPUTE_TICKERS
    ? new Set(process.env.BANK_PRECOMPUTE_TICKERS.split(",").map(t => t.trim().toUpperCase()))
    : null;

  const targets = tickerFilter
    ? uniqueBanks.filter(a => tickerFilter.has(a.ticker))
    : uniqueBanks;

  if (targets.length === 0) {
    console.log("No bank targets found. Check B3_UNIVERSE or BANK_PRECOMPUTE_TICKERS filter.");
    return;
  }

  console.log(`\nBank precompute — ${targets.length} unique bank entities (concurrency=${CONCURRENCY})\n`);

  const registry = await fetchRegistry();

  const tasks = targets.map(a => async () => {
    process.stdout.write(`\n[${a.ticker}] ${a.companyName}\n`);
    const result = await processTicker(a.ticker, a.companyName, registry);
    const tag = result.status === "ok" ? "OK" : result.status.toUpperCase();
    const detail = result.status === "ok" ? ` (${result.yearsFound} years)` : ` — ${result.error}`;
    console.log(`  → ${tag}${detail}`);
    return result;
  });

  const results = await runWithConcurrency(tasks, CONCURRENCY);

  console.log("\n─────────────────────────────────────────");
  const ok     = results.filter(r => r.status === "ok");
  const noCode = results.filter(r => r.status === "no_cvm_code");
  const noData = results.filter(r => r.status === "no_data");
  const errors = results.filter(r => r.status === "error");
  console.log(`  OK:           ${ok.length}`);
  console.log(`  No CVM code:  ${noCode.length}`);
  console.log(`  No data:      ${noData.length}`);
  console.log(`  Error:        ${errors.length}`);
  if (noCode.length > 0) {
    console.log("\n  Tickers without CVM match — add to CVM_CODE_OVERRIDES if known:");
    for (const r of noCode) console.log(`    "${r.ticker}": "XXXXXX",`);
  }
  console.log("\nDone. Cache written to src/data/bank-cache/annual/\n");
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
