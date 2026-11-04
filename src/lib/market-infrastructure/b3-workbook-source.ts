// Discovery and download of B3's official quarterly-data workbook from the
// B3 RI file manager (MZiQ — the API behind ri.b3.com.br). Precompute time
// only: the application never reaches B3 RI.
//
//   POST https://apicatalog.mziq.com/filemanager/company/{B3 company id}/filter/categories/year/meta
//        {"year": Y, "categories": ["central_de_resultados_dre"], "language": "pt_BR", "published": true}
//
// The listing's file_date is unreliable (4T25 shows 2025-12-31, published
// 2026-02-26); file_published_date, file_year and file_quarter are used.
//
// No @/ imports — also used by tsx scripts.

import { createHash } from "crypto";
import { normalizeDescription } from "./market-infrastructure-identity";
import { parseB3QuarterlyWorkbook, type ParsedB3Workbook } from "./b3-workbook";
import type { WorkbookSource } from "./market-infrastructure-types";

export const B3_MZ_COMPANY_ID = "5fd7b7d8-54a1-472d-8426-eb896ad8a3c4";
export const B3_MZ_LISTING_URL = `https://apicatalog.mziq.com/filemanager/company/${B3_MZ_COMPANY_ID}/filter/categories/year/meta`;
export const B3_WORKBOOK_CATEGORY = "central_de_resultados_dre";
export const B3_WORKBOOK_TITLE = "Dados Trimestrais - Nova Segmentação";

export interface MzDocumentMeta {
  id: string;
  company_id: string;
  file_name_original: string;
  file_url: string;
  file_quarter: number;
  file_year: number;
  file_published_date: string | null;
  file_title: string;
  internal_name: string;
  language_code: string;
  is_published: boolean;
}

/** The newest published "Dados Trimestrais - Nova Segmentação" workbook in a listing, or null. */
export function selectWorkbookMeta(metas: readonly MzDocumentMeta[]): MzDocumentMeta | null {
  const candidates = metas.filter(m =>
    m.company_id === B3_MZ_COMPANY_ID &&
    m.internal_name === B3_WORKBOOK_CATEGORY &&
    m.language_code === "pt_BR" &&
    m.is_published &&
    normalizeDescription(m.file_title) === normalizeDescription(B3_WORKBOOK_TITLE) &&
    Number.isInteger(m.file_year) && m.file_quarter >= 1 && m.file_quarter <= 4 &&
    /^https:\/\/api\.mziq\.com\/mzfilemanager\//.test(m.file_url));
  return candidates.sort((a, b) => (b.file_year * 4 + b.file_quarter) - (a.file_year * 4 + a.file_quarter))[0] ?? null;
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export type WorkbookOutcome =
  | { ok: true; value: { parsed: ParsedB3Workbook; source: WorkbookSource } }
  | { ok: false; error: string };

async function listYear(year: number, fetcher: Fetcher): Promise<MzDocumentMeta[]> {
  const res = await fetcher(B3_MZ_LISTING_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ year, categories: [B3_WORKBOOK_CATEGORY], language: "pt_BR", published: true }),
  });
  if (!res.ok) throw new Error(`B3 RI listing ${year}: HTTP ${res.status}`);
  const body = (await res.json()) as { success?: boolean; data?: { document_metas?: MzDocumentMeta[] } };
  if (!body.success || !Array.isArray(body.data?.document_metas)) throw new Error(`B3 RI listing ${year}: unexpected response`);
  return body.data!.document_metas!;
}

/** Downloads and parses the latest workbook (current year, else the previous one). */
export async function fetchB3Workbook(now: Date = new Date(), fetcher: Fetcher = fetch): Promise<WorkbookOutcome> {
  try {
    const year = now.getUTCFullYear();
    let meta = selectWorkbookMeta(await listYear(year, fetcher));
    if (!meta) meta = selectWorkbookMeta(await listYear(year - 1, fetcher));
    if (!meta) return { ok: false, error: "no published quarterly-data workbook in the B3 RI listing" };

    const res = await fetcher(meta.file_url);
    if (!res.ok) return { ok: false, error: `workbook download HTTP ${res.status}` };
    const bytes = new Uint8Array(await res.arrayBuffer());
    const parsed = parseB3QuarterlyWorkbook(bytes);
    const expected = `${meta.file_quarter}T${String(meta.file_year).slice(2)}`;
    if (parsed.quarterLabel !== expected) {
      return { ok: false, error: `workbook latest column ${parsed.quarterLabel} ≠ listing quarter ${expected}` };
    }
    return {
      ok: true,
      value: {
        parsed,
        source: {
          title: meta.file_title,
          fileName: meta.file_name_original,
          url: meta.file_url,
          mzDocumentId: meta.id,
          publishedDate: meta.file_published_date?.slice(0, 10) ?? null,
          fileQuarter: meta.file_quarter,
          fileYear: meta.file_year,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          byteLength: bytes.length,
        },
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
