// CVM documents client — fetches official document metadata from
// dados.cvm.gov.br DFP ZIP files, which each contain a top-level catalog CSV:
//
//   dfp_cia_aberta_{year}.csv
//   Columns: CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;CATEG_DOC;ID_DOC;DT_RECEB;LINK_DOC
//
// The DFP ZIPs are shared with the financial-data client (dfp-client.ts). When
// financials have already been fetched for a company, the relevant ZIPs are
// already in-memory and document extraction is near-instant (no extra network).
//
// Future: add ITR catalog (itr_cia_aberta_{year}.csv) from the ITR ZIPs and
// FRE documents from https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/FRE/DADOS/

import { unzipSync } from "fflate";
import { fetchYearZip } from "./dfp-client";
import type { CvmDocument, EnetHit, EnetResponse } from "./documents-types";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_RESULTS   = 20;
const LOOKBACK_DAYS = 18 * 30; // ~18 months in days

// Cache: cvmCode → { docs, loadedAt }. TTL = 1 h.
const DOC_TTL_MS = 60 * 60 * 1000;
const docCache = new Map<string, { docs: CvmDocument[]; loadedAt: number }>();

// ─── Document type → friendly category label ──────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  DFP:                     "Demonstrações Anuais",
  ITR:                     "Resultado Trimestral",
  FRE:                     "Formulário de Referência",
  IAN:                     "Informações Anuais",
  "Fato Relevante":        "Fato Relevante",
  "Aviso aos Acionistas":  "Comunicado",
  "Comunicado ao Mercado": "Comunicado",
  AGO:                     "Assembleia",
  AGE:                     "Assembleia",
  "Edital de AGO":         "Assembleia",
  "Edital de AGE":         "Assembleia",
  FCA:                     "Formulário Cadastral",
};

/**
 * Maps a raw CVM document type code to a user-facing category label.
 * Pure — no side effects, safe to call in tests.
 */
export function classifyDocumentType(typeCode: string | undefined): string {
  if (!typeCode) return "Documento CVM";
  return TYPE_LABELS[typeCode] ?? TYPE_LABELS[typeCode.trim()] ?? "Documento CVM";
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Parses a CVM date string (ISO timestamp or YYYY-MM-DD) to a YYYY-MM-DD
 * string. Returns null when the value is unparseable or clearly invalid.
 * Pure — safe to call in tests.
 */
export function parseCvmDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const datePart = raw.split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const ts = Date.parse(datePart);
  if (isNaN(ts)) return null;
  const year = parseInt(datePart.slice(0, 4), 10);
  if (year < 2000 || year > new Date().getFullYear() + 1) return null;
  return datePart;
}

/** Returns true when date is within the LOOKBACK_DAYS window. */
function isWithinLookback(dateStr: string): boolean {
  const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  return Date.parse(dateStr) >= cutoff;
}

// ─── Sort helper ─────────────────────────────────────────────────────────────

/**
 * Sorts CvmDocument[] by date descending (newest first), does not mutate input.
 * Pure — safe to call in tests.
 */
export function sortDocumentsDesc(docs: CvmDocument[]): CvmDocument[] {
  return [...docs].sort((a, b) => b.date.localeCompare(a.date));
}

// ─── CSV catalog parsing ──────────────────────────────────────────────────────

/** One row from a CVM document catalog CSV (DFP or ITR metadata file). */
export interface CatalogRow {
  cnpjCia:  string;
  dtRefer:  string;   // YYYY-MM-DD — fiscal period end
  versao:   number;
  nomCia:   string;
  cdCvm:    string;   // raw, may be zero-padded (e.g. "009512")
  categDoc: string;   // e.g. "DFP", "ITR"
  idDoc:    string;   // numeric sequence used in the document URL
  dtReceb:  string;   // YYYY-MM-DD — date received by CVM
  linkDoc:  string;   // full URL to the document
}

/**
 * Parses a CVM document catalog CSV (semicolon-delimited, latin-1 encoding)
 * and returns only the rows matching the given CVM code.
 *
 * Expected header:
 *   CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;CATEG_DOC;ID_DOC;DT_RECEB;LINK_DOC
 *
 * CVM codes are compared as integers to handle zero-padding differences.
 * Pure — safe to call in tests.
 */
export function parseCatalogCsv(text: string, cvmCode: string): CatalogRow[] {
  const targetCode = parseInt(cvmCode, 10);
  if (isNaN(targetCode)) return [];

  const lines = text.split("\n");
  if (lines.length < 2) return [];

  const rows: CatalogRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const p = line.split(";");
    if (p.length < 9) continue;

    const csvCode = parseInt(p[4].trim(), 10);
    if (isNaN(csvCode) || csvCode !== targetCode) continue;

    rows.push({
      cnpjCia:  p[0].trim(),
      dtRefer:  p[1].trim(),
      versao:   parseInt(p[2].trim(), 10) || 1,
      nomCia:   p[3].trim(),
      cdCvm:    p[4].trim(),
      categDoc: p[5].trim(),
      idDoc:    p[6].trim(),
      dtReceb:  p[7].trim(),
      linkDoc:  p[8].trim(),
    });
  }

  return rows;
}

/**
 * Converts a CatalogRow into a CvmDocument.
 * Returns null when DT_RECEB cannot be parsed or is outside the lookback window.
 * Pure — safe to call in tests.
 */
export function normalizeCatalogRow(row: CatalogRow): CvmDocument | null {
  const date = parseCvmDate(row.dtReceb);
  if (!date) return null;
  if (!isWithinLookback(date)) return null;

  const category = classifyDocumentType(row.categDoc);
  const year     = row.dtRefer.slice(0, 4);
  const title    = `${category} — exercício ${year}`;
  const url      = row.linkDoc.startsWith("http") ? row.linkDoc : undefined;

  return {
    id:       row.idDoc || `${row.cdCvm}-${row.dtReceb}`,
    date,
    category,
    title,
    type:     row.categDoc,
    url,
    source:   "CVM",
  };
}

// ─── ENET hit normalizer (kept for documentation / future fallback) ────────────

/**
 * Normalizes one raw ENET search-API hit into a CvmDocument.
 * Currently unused because efts.cvm.gov.br is not reachable from the server.
 * Kept so the pure function tests remain valid and can serve as a template when
 * the ENET API becomes accessible.
 * Pure — safe to call in tests.
 */
export function normalizeEnetHit(raw: unknown): CvmDocument | null {
  if (!raw || typeof raw !== "object") return null;

  const hit = raw as EnetHit;
  const src = hit._source;

  const date = parseCvmDate(src?.DtRecebimento);
  if (!date) return null;

  const typeCode = src?.CodTipoDocumento ?? src?.SgDocumento;
  const category = classifyDocumentType(typeCode);
  const title =
    (src?.Assunto && src.Assunto.trim() !== "")
      ? src.Assunto.trim()
      : (src?.DescTipoDocumento ?? category);
  const id =
    src?.NumSequencia !== undefined
      ? String(src.NumSequencia)
      : (hit._id ?? `doc-${date}`);

  const RAD_VIEWER = "https://www.rad.cvm.gov.br/ENET/frmVisualizadorExt.aspx";
  const url =
    (src?.NumSequencia !== undefined
      ? `${RAD_VIEWER}?NumeroSequenciaDocumento=${src.NumSequencia}&CodigoTipoInstituicao=1`
      : undefined) ??
    (src?.LinkDoc && src.LinkDoc.startsWith("http") ? src.LinkDoc : undefined);

  return { id, date, category, title, type: typeCode, url, source: "CVM" };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the most recent CVM documents for a company.
 *
 * Implementation: reads the document catalog CSV embedded in each year's DFP
 * ZIP (`dfp_cia_aberta_{year}.csv`) from dados.cvm.gov.br. ZIPs that were
 * already fetched by the financials endpoint are served from the shared cache
 * in dfp-client.ts — no extra network round-trip.
 *
 * The check covers the 3 most recent fiscal years to capture both the latest
 * annual filing and any re-filings from the prior year still within the
 * 18-month lookback window.
 *
 * TODO: extend with ITR catalog (itr_cia_aberta_{year}.csv) for quarterly reports.
 */
export async function fetchCvmDocuments(
  _ticker: string,
  cvmCode: string,
): Promise<CvmDocument[]> {
  const cached = docCache.get(cvmCode);
  if (cached && Date.now() - cached.loadedAt < DOC_TTL_MS) {
    return cached.docs;
  }

  const currentYear = new Date().getFullYear();
  // Check 3 most recent fiscal years. Earlier years are unlikely to have
  // filings within the 18-month lookback window.
  const yearsToCheck = [currentYear - 2, currentYear - 1, currentYear];

  const docArrays = await Promise.all(
    yearsToCheck.map(async (year): Promise<CvmDocument[]> => {
      const zip = await fetchYearZip(year);
      if (!zip) return [];

      const filename = `dfp_cia_aberta_${year}.csv`;
      let extracted: Record<string, Uint8Array>;
      try {
        extracted = unzipSync(zip, { filter: (f) => f.name === filename });
      } catch {
        return [];
      }

      const fileBytes = extracted[filename];
      if (!fileBytes) return [];

      const text = new TextDecoder("latin1").decode(fileBytes);
      return parseCatalogCsv(text, cvmCode)
        .map(normalizeCatalogRow)
        .filter((d): d is CvmDocument => d !== null);
    }),
  );

  const docs = sortDocumentsDesc(docArrays.flat()).slice(0, MAX_RESULTS);
  docCache.set(cvmCode, { docs, loadedAt: Date.now() });
  return docs;
}

// Re-export raw type for route layer
export type { EnetResponse };
