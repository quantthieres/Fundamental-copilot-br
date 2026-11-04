// Consolidated CVM DFP/ITR row extraction for the market-infrastructure model.
//
// Separate from cvm/dfp-parser.ts (industrial: drops CNPJ, version, DT_INI
// and ST_CONTA_FIXA) and from holdings/holding-cvm-rows.ts (parent-only).
// This reader keeps everything the model verifies: CNPJ, filing version,
// ORDEM_EXERC (current vs comparative), DT_INI (YTD vs single quarter),
// ST_CONTA_FIXA and GRUPO_DFP. Parent-only (DF Individual) rows are counted
// and rejected.
//
// Pure functions over decoded CSV text — the zip download lives in
// market-infrastructure-cvm-client.ts.
//
// No @/ imports — also used by tsx scripts.

import type { ShareCountSnapshot } from "./market-infrastructure-types";

export interface CvmRow {
  statement: string;
  /** DT_REFER of the filing. */
  filingReferenceDate: string;
  version: number;
  /** ÚLTIMO = the filing's own period; PENÚLTIMO = the comparative it restates. */
  order: "current" | "comparative";
  /** DT_INI_EXERC; "" for balance-sheet rows. */
  periodStart: string;
  /** DT_FIM_EXERC. */
  periodEnd: string;
  code: string;
  description: string;
  fixed: boolean;
  /** BRL. */
  value: number;
}

export interface CsvRowsResult {
  rows: CvmRow[];
  /** DF Individual rows of the issuer, dropped. */
  rejectedParentOnly: number;
  /** Rows of the issuer's CD_CVM filed under another CNPJ. */
  rejectedCnpj: number;
}

export interface FilingIndexEntry {
  filingReferenceDate: string;
  version: number;
  document: "DFP" | "ITR";
  documentId: string;
  receivedDate: string;
}

const digits = (s: string) => s.replace(/\D/g, "");
const normCode = (s: string) => s.trim().replace(/^0+(?=\d)/, "");

function headerIndex(line: string): Record<string, number> {
  return Object.fromEntries(line.split(";").map((h, i) => [h.trim().replace(/^﻿/, ""), i]));
}

function requireColumns(idx: Record<string, number>, cols: readonly string[], file: string): void {
  for (const col of cols) {
    if (!(col in idx)) throw new Error(`${file}: missing column ${col}`);
  }
}

const SCALE: Record<string, number> = { MIL: 1_000, UNIDADE: 1 };
const ORDER: Record<string, CvmRow["order"]> = { "ÚLTIMO": "current", "PENÚLTIMO": "comparative" };

/**
 * Reads one DFP/ITR statement CSV (BPA/BPP/DRE/DFC_MI) and returns the
 * issuer's consolidated rows. Throws when the file does not have the CVM
 * statement layout or uses an unknown currency scale.
 */
export function parseConsolidatedStatementCsv(
  csvText: string,
  statement: string,
  issuer: { cvmCode: string; cnpj: string },
): CsvRowsResult {
  const lines = csvText.split(/\r?\n/);
  const idx = headerIndex(lines[0] ?? "");
  requireColumns(idx, ["CNPJ_CIA", "DT_REFER", "VERSAO", "CD_CVM", "GRUPO_DFP", "ESCALA_MOEDA",
    "ORDEM_EXERC", "DT_FIM_EXERC", "CD_CONTA", "DS_CONTA", "VL_CONTA", "ST_CONTA_FIXA"], statement);
  const hasStart = "DT_INI_EXERC" in idx;
  const code = normCode(issuer.cvmCode);
  const cnpj = digits(issuer.cnpj);

  const rows: CvmRow[] = [];
  let rejectedParentOnly = 0;
  let rejectedCnpj = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const c = line.split(";");
    if (normCode(c[idx.CD_CVM] ?? "") !== code) continue;
    if (digits(c[idx.CNPJ_CIA] ?? "") !== cnpj) { rejectedCnpj++; continue; }
    const grupo = c[idx.GRUPO_DFP]?.trim() ?? "";
    if (!grupo.startsWith("DF Consolidado")) { rejectedParentOnly++; continue; }
    const order = ORDER[c[idx.ORDEM_EXERC]?.trim() ?? ""];
    if (!order) continue;

    const escala = c[idx.ESCALA_MOEDA]?.trim().toUpperCase() ?? "";
    const scale = SCALE[escala];
    if (scale === undefined) throw new Error(`${statement}: unknown ESCALA_MOEDA "${escala}"`);
    const raw = Number(c[idx.VL_CONTA]?.trim());
    if (!Number.isFinite(raw)) continue;

    rows.push({
      statement,
      filingReferenceDate: c[idx.DT_REFER].trim(),
      version: Number(c[idx.VERSAO]),
      order,
      periodStart: hasStart ? c[idx.DT_INI_EXERC].trim() : "",
      periodEnd: c[idx.DT_FIM_EXERC].trim(),
      code: c[idx.CD_CONTA].trim(),
      description: c[idx.DS_CONTA].trim(),
      fixed: c[idx.ST_CONTA_FIXA]?.trim() === "S",
      value: Math.round(raw * scale),
    });
  }
  return { rows, rejectedParentOnly, rejectedCnpj };
}

/** Reads the dfp_/itr_cia_aberta_YYYY.csv filing index for one issuer. */
export function parseFilingIndexCsv(csvText: string, issuer: { cvmCode: string; cnpj: string }): FilingIndexEntry[] {
  const lines = csvText.split(/\r?\n/);
  const idx = headerIndex(lines[0] ?? "");
  requireColumns(idx, ["CNPJ_CIA", "DT_REFER", "VERSAO", "CD_CVM", "CATEG_DOC", "ID_DOC", "DT_RECEB"], "filing index");
  const code = normCode(issuer.cvmCode);
  const cnpj = digits(issuer.cnpj);
  const out: FilingIndexEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(";");
    if (normCode(c[idx.CD_CVM] ?? "") !== code || digits(c[idx.CNPJ_CIA] ?? "") !== cnpj) continue;
    const document = c[idx.CATEG_DOC]?.trim();
    if (document !== "DFP" && document !== "ITR") continue;
    out.push({
      filingReferenceDate: c[idx.DT_REFER].trim(),
      version: Number(c[idx.VERSAO]),
      document,
      documentId: c[idx.ID_DOC].trim(),
      receivedDate: c[idx.DT_RECEB].trim(),
    });
  }
  return out;
}

/**
 * Reads composicao_capital for one issuer (matched by CNPJ — the file has no
 * CD_CVM). B3 files counts in units (5,046,500,000 issued at 2026-06-30), so
 * no scale is applied. A single-class issuer must report no preferred shares.
 */
export function parseShareCountCsv(
  csvText: string,
  cnpjFormatted: string,
  document: "DFP" | "ITR",
): ShareCountSnapshot[] {
  const lines = csvText.split(/\r?\n/);
  const idx = headerIndex(lines[0] ?? "");
  requireColumns(idx, ["CNPJ_CIA", "DT_REFER", "VERSAO", "QT_ACAO_ORDIN_CAP_INTEGR", "QT_ACAO_PREF_CAP_INTEGR",
    "QT_ACAO_ORDIN_TESOURO", "QT_ACAO_PREF_TESOURO"], "composicao_capital");
  const cnpj = digits(cnpjFormatted);
  const count = (s: string | undefined) => {
    const n = Number((s ?? "").trim());
    if (!Number.isInteger(n) || n < 0) throw new Error(`composicao_capital: bad share count "${s}"`);
    return n;
  };
  const out: ShareCountSnapshot[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(";");
    if (digits(c[idx.CNPJ_CIA] ?? "") !== cnpj) continue;
    if (count(c[idx.QT_ACAO_PREF_CAP_INTEGR]) !== 0 || count(c[idx.QT_ACAO_PREF_TESOURO]) !== 0) {
      throw new Error(`composicao_capital ${c[idx.DT_REFER]}: preferred shares reported for a single-class issuer`);
    }
    const issued = count(c[idx.QT_ACAO_ORDIN_CAP_INTEGR]);
    const treasury = count(c[idx.QT_ACAO_ORDIN_TESOURO]);
    out.push({
      referenceDate: c[idx.DT_REFER].trim(),
      document,
      filingVersion: Number(c[idx.VERSAO]),
      issuedShares: issued,
      treasuryShares: treasury,
      outstandingShares: issued - treasury,
    });
  }
  return out;
}

export interface RawFiling {
  document: "DFP" | "ITR";
  filingReferenceDate: string;
  version: number;
  rows: CvmRow[];
}

/** Groups rows by filing and keeps only the highest filed version of each. */
export function groupRowsByFiling(rows: readonly CvmRow[], document: "DFP" | "ITR"): RawFiling[] {
  const maxVersion = new Map<string, number>();
  for (const r of rows) maxVersion.set(r.filingReferenceDate, Math.max(maxVersion.get(r.filingReferenceDate) ?? 0, r.version));
  const byFiling = new Map<string, CvmRow[]>();
  for (const r of rows) {
    if (r.version !== maxVersion.get(r.filingReferenceDate)) continue;
    let bucket = byFiling.get(r.filingReferenceDate);
    if (!bucket) byFiling.set(r.filingReferenceDate, bucket = []);
    bucket.push(r);
  }
  return [...byFiling.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ref, filingRows]) => ({ document, filingReferenceDate: ref, version: maxVersion.get(ref)!, rows: filingRows }));
}
