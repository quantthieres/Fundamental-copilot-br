// Fundamentals aliases: tickers whose financial fundamentals are read from
// another ticker's model cache because both represent the SAME issuer.
//
// Semantics (enforced by callers):
//   - requested ticker is kept everywhere (UI, API `ticker`, report title);
//   - market quote, share class and trading name stay ticker-specific;
//   - only cached fundamentals (bank/FII/insurance/CVM/forecast caches) are
//     looked up under `fundamentalsTicker`.
// Never derived from company names. Every alias must point at a cache built
// from the same CVM entity (checked in fundamentals-alias.test.ts).
//
// No @/ imports — also used by tsx scripts.

export type FundamentalsAliasReason =
  /** Another share class of the same issuer already has the model cache. */
  | "same_issuer_share_class"
  /** Same issuer under a new trading code; the cache is still keyed by the
   *  former code until the next re-keyed precompute. */
  | "same_issuer_ticker_change"
  /** Different issuers (corporate incorporation), but the committed cache of
   *  the former code was already built from the CURRENT issuer's CVM filings.
   *  Valid only while that holds — checked in fundamentals-alias.test.ts. */
  | "issuer_transition_cache_from_current_issuer";

export interface FundamentalsAlias {
  ticker: string;
  fundamentalsTicker: string;
  reason: FundamentalsAliasReason;
}

const A = (ticker: string, fundamentalsTicker: string, reason: FundamentalsAliasReason): FundamentalsAlias =>
  ({ ticker, fundamentalsTicker, reason });

export const FUNDAMENTALS_ALIASES: Readonly<Record<string, FundamentalsAlias>> = Object.fromEntries([
  // Banks: ON and PN of the same bank (CVM 19348 Itaú Unibanco, 906 Bradesco).
  A("ITUB3", "ITUB4", "same_issuer_share_class"),
  A("BBDC3", "BBDC4", "same_issuer_share_class"),
  // Current codes of issuers whose CVM caches are still keyed by the old code.
  A("AXIA3", "ELET3", "same_issuer_ticker_change"),  // CVM 2437
  A("EMBJ3", "EMBR3", "same_issuer_ticker_change"),  // CVM 20087
  A("ISAE4", "TRPL4", "same_issuer_ticker_change"),  // CVM 18376
  A("SAUD3", "ODPV3", "same_issuer_ticker_change"),  // CVM 20125
  A("AZZA3", "ARZZ3", "same_issuer_ticker_change"),  // CVM 22349
  A("MBRF3", "MRFG3", "same_issuer_ticker_change"),  // CVM 20788
  A("AZUL3", "AZUL4", "same_issuer_ticker_change"),  // CVM 24112
  // Natura &Co Holding (NTCO3, CVM 24783) was incorporated by Natura
  // Cosméticos (NATU3, CVM 19550) on 2025-07-01 — an issuer transition, not a
  // rename. The alias is safe only because company-map.ts already sources the
  // NTCO3 cache from CVM 19550, i.e. from NATU3's issuer.
  A("NATU3", "NTCO3", "issuer_transition_cache_from_current_issuer"),
].map(a => [a.ticker, a]));

export function getFundamentalsAlias(ticker: string): FundamentalsAlias | null {
  return FUNDAMENTALS_ALIASES[ticker.toUpperCase()] ?? null;
}

/**
 * Ticker whose cached fundamentals represent `ticker`'s issuer. Identity for
 * tickers without an alias (ITUB4 → ITUB4).
 */
export function resolveFundamentalsTicker(ticker: string): string {
  const t = ticker.toUpperCase();
  return FUNDAMENTALS_ALIASES[t]?.fundamentalsTicker ?? t;
}

/** Response metadata for APIs serving an aliased ticker; null when not aliased. */
export function fundamentalsAliasMeta(ticker: string):
  { requestedTicker: string; fundamentalsTicker: string; reason: FundamentalsAliasReason } | null {
  const alias = getFundamentalsAlias(ticker);
  return alias ? { requestedTicker: alias.ticker, fundamentalsTicker: alias.fundamentalsTicker, reason: alias.reason } : null;
}

/**
 * Re-labels a cached model response for the requested ticker: `ticker` (and a
 * nested `company.ticker` / `fund.ticker`, when present) become the requested
 * code and `fundamentalsAlias` records where the fundamentals came from.
 * Returns the input unchanged for non-aliased tickers.
 */
export function withRequestedTicker<T extends { ticker: string }>(data: T, requestedTicker: string): T {
  const meta = fundamentalsAliasMeta(requestedTicker);
  if (!meta) return data;
  const out: Record<string, unknown> = { ...data, ticker: meta.requestedTicker, fundamentalsAlias: meta };
  for (const key of ["company", "fund"] as const) {
    const nested = (data as Record<string, unknown>)[key];
    if (nested && typeof nested === "object" && "ticker" in nested) {
      out[key] = { ...(nested as Record<string, unknown>), ticker: meta.requestedTicker };
    }
  }
  return out as unknown as T;
}
