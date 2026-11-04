// Network access to the official holding portfolio sources (precompute time
// only — the application reads committed cache). fetch is injectable so tests
// never reach the live sites.
//
// No @/ imports — also used by tsx scripts.

import { ITAUSA_PORTFOLIO_URL, parseItausaPortfolioHtml } from "./itausa-portfolio";
import {
  BRADESPAR_BQ_LISTING_URL,
  bulletinToPortfolio,
  latestBulletinFromListing,
  parseBulletinText,
} from "./bradespar-bulletin";
import { extractBulletinText } from "./bradespar-pdf-text";
import type { PortfolioOutcome, SourceOutcome } from "./holding-refresh";

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}
export type FetchLike = (url: string) => Promise<FetchResponseLike>;

const defaultFetch: FetchLike = url =>
  fetch(url, { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0" } });

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function fetchItausaPortfolio(fetchImpl: FetchLike = defaultFetch): Promise<SourceOutcome<PortfolioOutcome>> {
  try {
    const res = await fetchImpl(ITAUSA_PORTFOLIO_URL);
    if (!res.ok) return { ok: false, error: `Itaúsa portfolio page HTTP ${res.status}` };
    const parsed = parseItausaPortfolioHtml(await res.text());
    return parsed.ok
      ? { ok: true, value: { portfolio: parsed.portfolio, warnings: parsed.warnings } }
      : { ok: false, error: `Itaúsa portfolio page: ${parsed.error}` };
  } catch (err) {
    return { ok: false, error: `Itaúsa portfolio page: ${message(err)}` };
  }
}

export async function fetchBradesparPortfolio(
  fetchImpl: FetchLike = defaultFetch,
  extractText: (pdf: Uint8Array) => Promise<string> = extractBulletinText,
): Promise<SourceOutcome<PortfolioOutcome>> {
  try {
    const listRes = await fetchImpl(BRADESPAR_BQ_LISTING_URL);
    if (!listRes.ok) return { ok: false, error: `Bradespar bulletin listing HTTP ${listRes.status}` };
    const listing = latestBulletinFromListing(JSON.parse(await listRes.text()));
    const pdfRes = await fetchImpl(listing.pdfUrl);
    if (!pdfRes.ok) return { ok: false, error: `Bradespar bulletin ${listing.title} HTTP ${pdfRes.status}` };
    const text = await extractText(new Uint8Array(await pdfRes.arrayBuffer()));
    const parsed = bulletinToPortfolio(parseBulletinText(text), listing);
    return parsed.ok
      ? { ok: true, value: { portfolio: parsed.portfolio, warnings: parsed.warnings } }
      : { ok: false, error: `Bradespar bulletin ${listing.title}: ${parsed.error}` };
  } catch (err) {
    return { ok: false, error: `Bradespar bulletin: ${message(err)}` };
  }
}
