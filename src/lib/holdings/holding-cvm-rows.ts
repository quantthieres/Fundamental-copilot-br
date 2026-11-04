// Parent-only (individual) CVM DFP/ITR row extraction for holdings.
//
// Deliberately separate from cvm/dfp-parser.ts (the industrial parser, which
// reads consolidated statements and drops CNPJ, version and fixed-account
// metadata). This reader keeps everything the holding model must verify:
// CNPJ, filing version, DT_INI (YTD selection), ST_CONTA_FIXA and GRUPO_DFP.
//
// Pure functions over decoded CSV text — the zip download lives in
// holding-cvm-client.ts.
//
// No @/ imports — also used by tsx scripts.

export interface HoldingCvmRow {
  statement: string;
  periodEnd: string;
  version: number;
  /** "" for balance-sheet rows. */
  periodStart: string;
  code: string;
  description: string;
  fixed: boolean;
  /** BRL. */
  value: number;
}

export interface CsvRowsResult {
  rows: HoldingCvmRow[];
  /** Rows dropped because they belong to the consolidated statements. */
  rejectedConsolidated: number;
  /** Rows of the issuer's CD_CVM filed under a different CNPJ. */
  rejectedCnpj: number;
}

function digits(s: string): string {
  return s.replace(/\D/g, "");
}

function normCode(s: string): string {
  return s.trim().replace(/^0+(?=\d)/, "");
}

function headerIndex(line: string): Record<string, number> {
  return Object.fromEntries(line.split(";").map((h, i) => [h.trim().replace(/^﻿/, ""), i]));
}

const SCALE: Record<string, number> = { MIL: 1_000, UNIDADE: 1 };

/**
 * Reads one DFP/ITR statement CSV (BPA/BPP/DRE/DFC) and returns the ÚLTIMO
 * rows of the issuer's individual statements. Throws when the file does not
 * have the CVM statement layout or uses an unknown currency scale.
 */
export function parseHoldingStatementCsv(
  csvText: string,
  statement: string,
  issuer: { cvmCode: string; cnpj: string },
): CsvRowsResult {
  const lines = csvText.split(/\r?\n/);
  const idx = headerIndex(lines[0] ?? "");
  const required = ["CNPJ_CIA", "DT_REFER", "VERSAO", "CD_CVM", "GRUPO_DFP", "ESCALA_MOEDA",
    "ORDEM_EXERC", "DT_FIM_EXERC", "CD_CONTA", "DS_CONTA", "VL_CONTA", "ST_CONTA_FIXA"];
  for (const col of required) {
    if (!(col in idx)) throw new Error(`${statement}: missing column ${col}`);
  }
  const hasStart = "DT_INI_EXERC" in idx;
  const code = normCode(issuer.cvmCode);
  const cnpj = digits(issuer.cnpj);

  const rows: HoldingCvmRow[] = [];
  let rejectedConsolidated = 0;
  let rejectedCnpj = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const c = line.split(";");
    if (normCode(c[idx.CD_CVM] ?? "") !== code) continue;
    if (c[idx.ORDEM_EXERC]?.trim() !== "ÚLTIMO") continue;
    if (digits(c[idx.CNPJ_CIA] ?? "") !== cnpj) { rejectedCnpj++; continue; }
    const grupo = c[idx.GRUPO_DFP]?.trim() ?? "";
    if (!grupo.startsWith("DF Individual")) { rejectedConsolidated++; continue; }

    const escala = c[idx.ESCALA_MOEDA]?.trim().toUpperCase() ?? "";
    const scale = SCALE[escala];
    if (scale === undefined) throw new Error(`${statement}: unknown ESCALA_MOEDA "${escala}"`);
    const raw = Number(c[idx.VL_CONTA]?.trim());
    if (!Number.isFinite(raw)) continue;

    rows.push({
      statement,
      periodEnd: c[idx.DT_FIM_EXERC].trim(),
      version: Number(c[idx.VERSAO]),
      periodStart: hasStart ? c[idx.DT_INI_EXERC].trim() : "",
      code: c[idx.CD_CONTA].trim(),
      description: c[idx.DS_CONTA].trim(),
      fixed: c[idx.ST_CONTA_FIXA]?.trim() === "S",
      value: Math.round(raw * scale),
    });
  }
  return { rows, rejectedConsolidated, rejectedCnpj };
}

export interface CvmFilingIndexEntry {
  periodEnd: string;
  version: number;
  document: "DFP" | "ITR";
  documentId: string;
  receivedDate: string;
}

/** Reads the dfp_/itr_cia_aberta_YYYY.csv filing index for one issuer. */
export function parseFilingIndexCsv(
  csvText: string,
  issuer: { cvmCode: string; cnpj: string },
): CvmFilingIndexEntry[] {
  const lines = csvText.split(/\r?\n/);
  const idx = headerIndex(lines[0] ?? "");
  for (const col of ["CNPJ_CIA", "DT_REFER", "VERSAO", "CD_CVM", "CATEG_DOC", "ID_DOC", "DT_RECEB"]) {
    if (!(col in idx)) throw new Error(`filing index: missing column ${col}`);
  }
  const code = normCode(issuer.cvmCode);
  const cnpj = digits(issuer.cnpj);
  const out: CvmFilingIndexEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(";");
    if (normCode(c[idx.CD_CVM] ?? "") !== code || digits(c[idx.CNPJ_CIA] ?? "") !== cnpj) continue;
    const document = c[idx.CATEG_DOC]?.trim();
    if (document !== "DFP" && document !== "ITR") continue;
    out.push({
      periodEnd: c[idx.DT_REFER].trim(),
      version: Number(c[idx.VERSAO]),
      document,
      documentId: c[idx.ID_DOC].trim(),
      receivedDate: c[idx.DT_RECEB].trim(),
    });
  }
  return out;
}

export interface CvmCapitalEntry {
  periodEnd: string;
  version: number;
  /** In shares (the CVM file publishes thousands of shares). */
  issuedOn: number;
  issuedPn: number;
  treasuryOn: number;
  treasuryPn: number;
}

/** Reads composicao_capital for one issuer (matched by CNPJ — the file has no CD_CVM). */
export function parseCapitalCsv(csvText: string, cnpjFormatted: string): CvmCapitalEntry[] {
  const lines = csvText.split(/\r?\n/);
  const idx = headerIndex(lines[0] ?? "");
  const cols = ["CNPJ_CIA", "DT_REFER", "VERSAO", "QT_ACAO_ORDIN_CAP_INTEGR", "QT_ACAO_PREF_CAP_INTEGR",
    "QT_ACAO_ORDIN_TESOURO", "QT_ACAO_PREF_TESOURO"];
  for (const col of cols) {
    if (!(col in idx)) throw new Error(`composicao_capital: missing column ${col}`);
  }
  const cnpj = digits(cnpjFormatted);
  const thousand = (s: string | undefined) => {
    const n = Number((s ?? "").trim());
    if (!Number.isFinite(n)) throw new Error(`composicao_capital: bad share count "${s}"`);
    return n * 1_000;
  };
  const out: CvmCapitalEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(";");
    if (digits(c[idx.CNPJ_CIA] ?? "") !== cnpj) continue;
    out.push({
      periodEnd: c[idx.DT_REFER].trim(),
      version: Number(c[idx.VERSAO]),
      issuedOn: thousand(c[idx.QT_ACAO_ORDIN_CAP_INTEGR]),
      issuedPn: thousand(c[idx.QT_ACAO_PREF_CAP_INTEGR]),
      treasuryOn: thousand(c[idx.QT_ACAO_ORDIN_TESOURO]),
      treasuryPn: thousand(c[idx.QT_ACAO_PREF_TESOURO]),
    });
  }
  return out;
}

export interface HoldingRawPeriod {
  periodEnd: string;
  version: number;
  /** Balance rows and YTD flow rows only (single-quarter rows dropped). */
  rows: HoldingCvmRow[];
}

/**
 * Groups rows by period, keeps the highest filed version per period and, for
 * flow statements, only the cumulative row starting on Jan 1 of the period's
 * year (ITR Q2/Q3 also carry a single-quarter row).
 */
export function groupRowsByPeriod(rows: readonly HoldingCvmRow[]): HoldingRawPeriod[] {
  const maxVersion = new Map<string, number>();
  for (const r of rows) maxVersion.set(r.periodEnd, Math.max(maxVersion.get(r.periodEnd) ?? 0, r.version));

  const byPeriod = new Map<string, HoldingCvmRow[]>();
  for (const r of rows) {
    if (r.version !== maxVersion.get(r.periodEnd)) continue;
    if (r.periodStart && r.periodStart !== `${r.periodEnd.slice(0, 4)}-01-01`) continue;
    let bucket = byPeriod.get(r.periodEnd);
    if (!bucket) byPeriod.set(r.periodEnd, bucket = []);
    bucket.push(r);
  }
  return [...byPeriod.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodEnd, periodRows]) => ({ periodEnd, version: maxVersion.get(periodEnd)!, rows: periodRows }));
}
