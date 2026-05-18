// Lightweight CVM FII informe mensal fetcher.
// Data source: https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS/
//   Annual ZIPs: inf_mensal_fii_YYYY.zip
//   Each ZIP contains 3 CSVs: geral, complemento, ativo_passivo
//   Key CNPJ field: CNPJ_Fundo_Classe
//   Key NAV fields (complemento): Patrimonio_Liquido, Cotas_Emitidas,
//     Valor_Patrimonial_Cotas, Percentual_Dividend_Yield_Mes
//
// Used only by the precompute script — never at dashboard request time.

import { unzipSync } from "fflate";

const INFORME_BASE = "https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS";
const BILLION      = 1_000_000_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FiiRawMonthlyRow {
  cnpj: string;
  referenceDate: string;
  netAssetValue: number | null;
  netAssetValuePerShare: number | null;
  quotaCount: number | null;
  monthlyDistributionPerShare: number | null;
}

// Name→CNPJ registry built from the geral CSV.
export interface FiiCvmRegistryEntry {
  cnpj: string;
  name: string;
}

// ── Name normalization ────────────────────────────────────────────────────────

export function normFiiName(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/FUNDO\s+DE\s+INVESTIMENTO\s+IMOBILI[AÁ]RIO/g, "")
    .replace(/FUNDO\s+DE\s+INVESTIMENTO\s+IMOBILI/g, "")
    .replace(/\bFII\b/g, "")
    .replace(/\bFDO\b/g, "")
    .replace(/\bDE\b/g, "")
    .replace(/[.\-/—–()]/g, " ")
    .replace(/\s+/g, " ").trim();
}

function parseBrDecimal(s: string | undefined): number | null {
  if (!s || s.trim() === "") return null;
  const v = parseFloat(s.replace(",", ".").trim());
  return isNaN(v) ? null : v;
}

// ── ZIP cache (one per year) ──────────────────────────────────────────────────

const zipCache = new Map<number, Uint8Array>();

async function getYearZip(year: number): Promise<Uint8Array | null> {
  const cached = zipCache.get(year);
  if (cached) return cached;

  const url = `${INFORME_BASE}/inf_mensal_fii_${year}.zip`;
  process.stdout.write(`  Downloading FII informe ${year}...`);
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

export function clearZipCache(): void {
  zipCache.clear();
}

// ── Registry from geral CSV ───────────────────────────────────────────────────

export async function buildFiiRegistry(referenceYear: number): Promise<FiiCvmRegistryEntry[]> {
  const zip = await getYearZip(referenceYear);
  if (!zip) return [];

  const filename = `inf_mensal_fii_geral_${referenceYear}.csv`;
  let extracted: Record<string, Uint8Array>;
  try {
    extracted = unzipSync(zip, { filter: f => f.name === filename });
  } catch { return []; }

  const fileBytes = extracted[filename];
  if (!fileBytes) return [];

  const text    = new TextDecoder("latin1").decode(fileBytes);
  const lines   = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(";").map(h => h.trim());
  const cnpjIdx = headers.indexOf("CNPJ_Fundo_Classe");
  const nameIdx = headers.indexOf("Nome_Fundo_Classe");
  if (cnpjIdx < 0 || nameIdx < 0) return [];

  const seen = new Set<string>();
  const results: FiiCvmRegistryEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(";");
    const cnpj = cols[cnpjIdx]?.trim();
    const name = cols[nameIdx]?.trim();
    if (!cnpj || !name || seen.has(cnpj)) continue;
    seen.add(cnpj);
    results.push({ cnpj, name });
  }
  return results;
}

export function findFundCnpj(
  ticker: string,
  companyName: string,
  registry: FiiCvmRegistryEntry[],
  overrides: Record<string, string>,
): string | null {
  if (overrides[ticker]) return overrides[ticker];

  const target = normFiiName(companyName);

  // Pass 1: exact normalized name match
  for (const entry of registry) {
    if (normFiiName(entry.name) === target) return entry.cnpj;
  }

  // Pass 2: all meaningful words (≥3 chars) present in registry name
  const words = target.split(" ").filter(w => w.length >= 3);
  if (words.length >= 2) {
    for (const entry of registry) {
      const normed = normFiiName(entry.name);
      if (words.every(w => normed.includes(w))) return entry.cnpj;
    }
  }

  return null;
}

// ── Monthly data extraction ───────────────────────────────────────────────────

// Returns all available monthly rows for a given CNPJ from a year's ZIP.
async function extractRowsForYear(
  cnpj: string,
  year: number,
): Promise<FiiRawMonthlyRow[]> {
  const zip = await getYearZip(year);
  if (!zip) return [];

  const filename = `inf_mensal_fii_complemento_${year}.csv`;
  let extracted: Record<string, Uint8Array>;
  try {
    extracted = unzipSync(zip, { filter: f => f.name === filename });
  } catch { return []; }

  const fileBytes = extracted[filename];
  if (!fileBytes) return [];

  const text    = new TextDecoder("latin1").decode(fileBytes);
  const lines   = text.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers  = lines[0].split(";").map(h => h.trim());
  const cnpjIdx  = headers.indexOf("CNPJ_Fundo_Classe");
  const dateIdx  = headers.indexOf("Data_Referencia");
  const navIdx   = headers.indexOf("Patrimonio_Liquido");
  const quotasIdx = headers.indexOf("Cotas_Emitidas");
  const vpIdx    = headers.indexOf("Valor_Patrimonial_Cotas");
  const dyIdx    = headers.indexOf("Percentual_Dividend_Yield_Mes");

  if (cnpjIdx < 0 || dateIdx < 0) return [];

  // Normalize CNPJ for comparison (digits only)
  const targetDigits = cnpj.replace(/\D/g, "");

  const rows: FiiRawMonthlyRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols     = line.split(";");
    const rowCnpj  = cols[cnpjIdx]?.trim() ?? "";
    if (rowCnpj.replace(/\D/g, "") !== targetDigits) continue;

    const navRaw   = parseBrDecimal(cols[navIdx]);
    const vpRaw    = parseBrDecimal(cols[vpIdx]);
    const quotasRaw = parseBrDecimal(cols[quotasIdx]);
    const dyRaw    = parseBrDecimal(cols[dyIdx]);

    const netAssetValue          = navRaw !== null ? navRaw / BILLION : null;
    const netAssetValuePerShare  = vpRaw;
    // Cotas_Emitidas is the quota count directly
    const quotaCount             = quotasRaw;

    // Monthly distribution: DY_decimal × NAV per share
    // Percentual_Dividend_Yield_Mes is stored as a decimal fraction (e.g. 0.00672
    // = 0.672%), not as a percentage value. Do NOT divide by 100.
    // dyRaw === 0 is treated as null — a zero in this CVM field is indistinguishable
    // from "not reported / not filed for this month" and produces misleading zeros.
    const monthlyDist = (dyRaw !== null && dyRaw !== 0 && vpRaw !== null)
      ? dyRaw * vpRaw
      : null;

    const refDate = cols[dateIdx]?.trim() ?? "";

    rows.push({
      cnpj,
      referenceDate: refDate,
      netAssetValue,
      netAssetValuePerShare,
      quotaCount,
      monthlyDistributionPerShare: monthlyDist,
    });
  }
  return rows;
}

// Returns all monthly rows for a CNPJ across the given years.
export async function fetchAllMonthlyRows(
  cnpj: string,
  years: number[],
): Promise<FiiRawMonthlyRow[]> {
  const all: FiiRawMonthlyRow[] = [];
  for (const year of years) {
    const rows = await extractRowsForYear(cnpj, year);
    all.push(...rows);
  }
  return all;
}
