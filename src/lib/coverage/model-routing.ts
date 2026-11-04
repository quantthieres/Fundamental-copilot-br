import type { B3Asset } from "../../data/b3-universe";
import { classifyAsset } from "./asset-classifier";
import { hasBankAnalysisCache } from "../banks/bank-coverage";
import { hasFiiAnalysisCache } from "../fiis/fii-coverage";
import { hasInsuranceAnalysisCache } from "../insurance/insurance-coverage";
import { resolveFundamentalsTicker } from "./fundamentals-alias";
import { isHoldingIssuerTicker } from "../holdings/holding-identities";

export type ModelRoute =
  | "industrial"
  | "bank"
  | "fii"
  | "insurance"
  | "informational_instrument"
  | "quote_only"
  | "sector_specific_pending"
  | "unavailable";

function richType(asset: B3Asset) {
  return classifyAsset(asset.ticker, {
    b3AssetType: asset.assetType,
    sector:      asset.sector,
    companyName: asset.companyName,
  });
}

/**
 * Resolves which dashboard model should handle a B3 asset.
 *
 * Priority:
 *   1. coverageStatus === "unavailable"  → unavailable (handles discontinued tickers)
 *   1b. holding issuer (ITSA3/4, BRAP3/4) → quote_only or sector_specific_pending
 *   2. bank with cache                   → bank
 *   3. fii with cache                    → fii
 *   4. insurance with cache              → insurance
 *   5. bank/fii/insurance without cache  → sector_specific_pending
 *   6. ETF / BDR / fund                  → informational_instrument
 *   7. industrial-eligible + CVM data    → industrial
 *   8. industrial-eligible quote-only    → quote_only
 *   9. financial / unknown               → sector_specific_pending or quote_only
 */
export function resolveModelRoute(asset: B3Asset): ModelRoute {
  const { ticker, coverageStatus } = asset;

  // Discontinued / explicitly unavailable wins unconditionally.
  if (coverageStatus === "unavailable") return "unavailable";

  // Holding issuers are never analysed by the bank or industrial models,
  // whatever the ticker suffix or sector heuristics say. The holding route is
  // not active yet (Phase 1: caches only), so they keep their pre-model route.
  if (isHoldingIssuerTicker(ticker)) {
    return coverageStatus === "quote_only" ? "quote_only" : "sector_specific_pending";
  }

  const type = richType(asset);

  // Sector-specific models — check whether a cache exists. Same-issuer aliases
  // (e.g. ITUB3 → ITUB4) use the canonical ticker's cache.
  const fundamentalsTicker = resolveFundamentalsTicker(ticker);
  if (type === "bank")      return hasBankAnalysisCache(fundamentalsTicker)      ? "bank"      : "sector_specific_pending";
  if (type === "fii")       return hasFiiAnalysisCache(fundamentalsTicker)       ? "fii"       : "sector_specific_pending";
  if (type === "insurance") return hasInsuranceAnalysisCache(fundamentalsTicker) ? "insurance" : "sector_specific_pending";

  // Informational layer: ETFs, BDRs, and funds never use industrial indicators.
  if (type === "etf" || type === "bdr" || type === "fund") return "informational_instrument";

  // Industrial pipeline (common_stock, preferred_stock, unit).
  if (type === "common_stock" || type === "preferred_stock" || type === "unit") {
    if (
      coverageStatus === "full_analysis"  ||
      coverageStatus === "cvm_analysis"   ||
      coverageStatus === "cvm_financials"
    ) return "industrial";
    if (coverageStatus === "quote_only") return "quote_only";
  }

  // financial, unknown.
  if (coverageStatus === "quote_only") return "quote_only";
  return "sector_specific_pending";
}
