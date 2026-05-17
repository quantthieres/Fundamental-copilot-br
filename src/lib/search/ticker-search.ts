import type { B3Asset } from "@/data/b3-universe";

export interface TickerSearchEntry {
  asset: B3Asset;
  nTicker: string;
  nCompanyName: string;
  nTradingName: string;
  nSector: string;
}

export function normalizeSearchText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    // strip combining diacritical marks (U+0300–U+036F)
    .replace(/[̀-ͯ]/g, "");
}

export function buildTickerSearchIndex(universe: B3Asset[]): TickerSearchEntry[] {
  return universe.map(asset => ({
    asset,
    nTicker: normalizeSearchText(asset.ticker),
    nCompanyName: normalizeSearchText(asset.companyName),
    nTradingName: normalizeSearchText(asset.tradingName),
    nSector: normalizeSearchText(asset.sector),
  }));
}

export function searchTickers(
  index: TickerSearchEntry[],
  query: string,
  maxResults = 10,
): B3Asset[] {
  const q = normalizeSearchText(query);
  if (!q) return [];

  const matched = index.filter(
    e =>
      e.nTicker.includes(q) ||
      e.nCompanyName.includes(q) ||
      e.nTradingName.includes(q) ||
      e.nSector.includes(q),
  );

  matched.sort((a, b) => {
    const aExact = a.nTicker === q;
    const bExact = b.nTicker === q;
    if (aExact !== bExact) return aExact ? -1 : 1;
    const aStarts = a.nTicker.startsWith(q);
    const bStarts = b.nTicker.startsWith(q);
    if (aStarts !== bStarts) return aStarts ? -1 : 1;
    return 0;
  });

  return matched.slice(0, maxResults).map(e => e.asset);
}

export function findExactTicker(
  index: TickerSearchEntry[],
  query: string,
): B3Asset | undefined {
  const q = query.trim().toUpperCase();
  return index.find(e => e.asset.ticker === q)?.asset;
}
