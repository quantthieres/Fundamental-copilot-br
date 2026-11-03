// B3 Fundos.Net (FNET) network access for structured distribution notices.
// Public endpoints, no authentication:
//   search:   /fnet/publico/pesquisarGerenciadorDocumentosDados  (JSON listing)
//   document: /fnet/publico/downloadDocumento?id=<id>             (notice XML)
//
// Used only by the precompute script — never at dashboard request time.
// fetch is injectable so tests never reach the live service.

import {
  parseListingRow,
  parseNoticeXml,
  type FnetNotice,
  type FnetNoticeListing,
} from "./fii-fnet-parser";

const FNET_BASE = "https://fnet.bmfbovespa.com.br/fnet/publico";

// Search filter ids: category "Aviso aos Cotistas - Estruturado", type
// "Rendimentos e Amortizações". Rows are re-checked by label in parseListingRow.
const CATEGORY_ID = 14;
const TYPE_ID = 41;
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

export type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

const defaultFetch: FetchLike = url =>
  fetch(url, { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0" } });

export interface FnetListingResult {
  notices: FnetNoticeListing[];
  // Rows that were not distribution notices or could not be read.
  rejectedRows: number;
}

export function buildSearchUrl(cnpjDigits: string, start: number): string {
  const q = new URLSearchParams({
    d: "1",
    s: String(start),
    l: String(PAGE_SIZE),
    "o[0][dataEntrega]": "desc",
    cnpjFundo: cnpjDigits,
    idCategoriaDocumento: String(CATEGORY_ID),
    idTipoDocumento: String(TYPE_ID),
    idEspecieDocumento: "0",
    tipoFundo: "1",
  });
  return `${FNET_BASE}/pesquisarGerenciadorDocumentosDados?${q}`;
}

/**
 * Lists a fund's distribution notices delivered on or after `sinceIso`
 * (yyyy-mm-dd), newest first. Throws when the listing itself is unavailable
 * or no longer has the expected shape.
 */
export async function listDistributionNotices(
  cnpj: string,
  sinceIso: string,
  fetchImpl: FetchLike = defaultFetch,
): Promise<FnetListingResult> {
  const cnpjDigits = cnpj.replace(/\D/g, "");
  const notices: FnetNoticeListing[] = [];
  let rejectedRows = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetchImpl(buildSearchUrl(cnpjDigits, page * PAGE_SIZE));
    if (!res.ok) throw new Error(`FNET search HTTP ${res.status}`);
    const body = JSON.parse(await res.text()) as { data?: unknown; recordsTotal?: unknown };
    if (!Array.isArray(body.data) || typeof body.recordsTotal !== "number") {
      throw new Error("FNET search returned an unexpected payload");
    }

    let reachedSince = false;
    for (const row of body.data) {
      const listing = parseListingRow(row);
      if (!listing) { rejectedRows++; continue; }
      if (listing.deliveredAt.slice(0, 10) < sinceIso) { reachedSince = true; continue; }
      notices.push(listing);
    }
    if (reachedSince || body.data.length < PAGE_SIZE || (page + 1) * PAGE_SIZE >= body.recordsTotal) break;
  }
  return { notices, rejectedRows };
}

export async function downloadNotice(
  id: number,
  fetchImpl: FetchLike = defaultFetch,
): Promise<FnetNotice> {
  const res = await fetchImpl(`${FNET_BASE}/downloadDocumento?id=${id}`);
  if (!res.ok) throw new Error(`FNET document ${id} HTTP ${res.status}`);
  const parsed = parseNoticeXml(await res.text());
  if (!parsed.ok) throw new Error(`FNET document ${id}: ${parsed.error}`);
  return parsed.notice;
}

export interface FetchedFnetNotice {
  listing: FnetNoticeListing;
  notice: FnetNotice | null;
  error?: string;
}

export interface FundNoticesResult {
  notices: FetchedFnetNotice[];
  rejectedRows: number;
}

/**
 * Listing plus parsed XML for every active notice. Superseded and cancelled
 * notices are kept from the listing (for auditing) but not downloaded — they
 * never contribute. A failed download is recorded per notice, not thrown.
 */
export async function fetchFundDistributionNotices(
  cnpj: string,
  sinceIso: string,
  fetchImpl: FetchLike = defaultFetch,
  delayMs = 150,
): Promise<FundNoticesResult> {
  const { notices, rejectedRows } = await listDistributionNotices(cnpj, sinceIso, fetchImpl);
  const out: FetchedFnetNotice[] = [];
  for (const listing of notices) {
    if (listing.status !== "active") { out.push({ listing, notice: null }); continue; }
    try {
      out.push({ listing, notice: await downloadNotice(listing.id, fetchImpl) });
    } catch (err) {
      out.push({ listing, notice: null, error: err instanceof Error ? err.message : String(err) });
    }
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
  }
  return { notices: out, rejectedRows };
}
