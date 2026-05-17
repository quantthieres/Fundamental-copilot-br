import type { AssetType } from "./coverage-types";

// ─── Explicit ticker → AssetType map ─────────────────────────────────────────
//
// Takes precedence over all pattern-based inference.
// Covers cases where the ticker suffix alone is ambiguous (e.g., 11-suffix
// used by units, FIIs, ETFs, and bank units alike).

const EXPLICIT_TICKER_MAP: Record<string, AssetType> = {
  // ── Banks (including bank units) ─────────────────────────────────────────
  ITUB4:  "bank",
  ITUB3:  "bank",
  BBDC4:  "bank",
  BBDC3:  "bank",
  BBAS3:  "bank",
  SANB11: "bank",  // Santander BR — bank unit, NOT an operating-company unit
  BPAC11: "bank",  // BTG Pactual — bank unit
  BRSR6:  "bank",

  // ── Financial holdings / exchange infrastructure ──────────────────────────
  ITSA4:  "financial",
  ITSA3:  "financial",
  B3SA3:  "financial",

  // ── Insurance ────────────────────────────────────────────────────────────
  BBSE3:  "insurance",
  PSSA3:  "insurance",
  SULA11: "insurance",  // SulAmérica — insurance unit
  IRBR3:  "insurance",
  CXSE3:  "insurance",

  // ── FIIs ─────────────────────────────────────────────────────────────────
  MXRF11: "fii",
  XPML11: "fii",
  HGLG11: "fii",
  KNRI11: "fii",
  VISC11: "fii",
  BCFF11: "fii",
  IRDM11: "fii",
  KNCR11: "fii",

  // ── ETFs ─────────────────────────────────────────────────────────────────
  BOVA11: "etf",
  IVVB11: "etf",
  SMAL11: "etf",
  HASH11: "etf",
  SPXI11: "etf",
  GOLD11: "etf",

  // ── BDRs ─────────────────────────────────────────────────────────────────
  AAPL34:  "bdr",
  MSFT34:  "bdr",
  TSLA34:  "bdr",
  AMZO34:  "bdr",
  GOGL34:  "bdr",
  NVDC34:  "bdr",
  GOOGL34: "bdr",

  // ── Operating-company units (eligible for industrial model) ───────────────
  // These end in 11 but are NOT FIIs, ETFs, or bank units.
  KLBN11: "unit",  // Klabin — paper & packaging operating company
  ALUP11: "unit",  // Alupar — power transmission operating company
  TAEE11: "unit",  // Taesa — power transmission operating company
  SAPR11: "unit",  // Sanepar — sanitation operating company
  IGTI11: "unit",  // Iguatemi — real estate operating company
  ENGI11: "unit",  // Energisa — energy distribution operating company
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function normalizeTicker(ticker: string): string {
  return ticker.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function getNumericSuffix(t: string): number | null {
  const match = t.match(/(\d+)$/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

function inferFromTickerStructure(t: string): AssetType {
  const suffix = getNumericSuffix(t);
  if (suffix === null) return "unknown";

  if (suffix === 34) return "bdr";
  if (suffix === 3)  return "common_stock";
  if (suffix >= 4 && suffix <= 8) return "preferred_stock";
  if (suffix === 11) return "unit";  // ambiguous: could be FII/ETF/unit — needs context

  return "unknown";
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Normalised ticker-only inference (explicit map + suffix patterns). */
export function inferAssetTypeFromTicker(ticker: string): AssetType {
  const t = normalizeTicker(ticker);
  return EXPLICIT_TICKER_MAP[t] ?? inferFromTickerStructure(t);
}

/**
 * Refines the type using optional company name and sector context.
 * Checks the explicit map first, then uses sector/name heuristics.
 */
export function inferAssetTypeFromKnownMappings(
  ticker: string,
  companyName?: string,
  sector?: string,
): AssetType {
  const t = normalizeTicker(ticker);
  if (EXPLICIT_TICKER_MAP[t]) return EXPLICIT_TICKER_MAP[t];

  if (sector) {
    if (sector === "Bancário" || sector === "Holding Financeira") return "bank";
    if (sector === "Seguros")  return "insurance";
    if (sector === "FII")      return "fii";
    if (sector === "ETF")      return "etf";
  }

  if (companyName) {
    const name = companyName.toUpperCase();
    if (name.includes(" FII") || name.includes("FUNDO IMOBILIÁRIO")) return "fii";
    if (name.includes("ETF")  || name.includes("EXCHANGE TRADED"))   return "etf";
  }

  return inferFromTickerStructure(t);
}

export type ClassificationContext = {
  b3AssetType?: "stock" | "unit" | "fii" | "etf" | "bdr" | "unknown";
  sector?: string;
  companyName?: string;
};

/**
 * Full classification using all available context.
 *
 * Priority order:
 *   1. Explicit ticker map
 *   2. B3 universe asset type (for unambiguous fii/etf/bdr)
 *   3. Sector + company name heuristics
 *   4. Ticker suffix patterns
 */
export function classifyAsset(
  ticker: string,
  context?: ClassificationContext,
): AssetType {
  const t = normalizeTicker(ticker);

  // Explicit map wins unconditionally.
  if (EXPLICIT_TICKER_MAP[t]) return EXPLICIT_TICKER_MAP[t];

  // B3 universe asset type resolves unambiguous cases.
  if (context?.b3AssetType) {
    switch (context.b3AssetType) {
      case "fii": return "fii";
      case "etf": return "etf";
      case "bdr": return "bdr";
      case "unit":
        // A unit in the banking or insurance sector is a bank/insurance unit,
        // not an operating-company unit eligible for the industrial model.
        if (context.sector === "Bancário" || context.sector === "Holding Financeira") return "bank";
        if (context.sector === "Seguros") return "insurance";
        return "unit";
      case "stock":
        return inferAssetTypeFromKnownMappings(t, context.companyName, context.sector);
    }
  }

  return inferAssetTypeFromKnownMappings(t, context?.companyName, context?.sector);
}
