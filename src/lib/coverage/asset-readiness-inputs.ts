// Server/script-side input collection for asset readiness (reads cache files).
// Do not import from client components.
//
// No @/ imports — also used by tsx scripts.

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { B3Asset } from "../../data/b3-universe";
import { B3_UNIVERSE } from "../../data/b3-universe";
import { classifyAsset } from "./asset-classifier";
import { countUsableAnnualYears } from "../cvm/annual-years";
import { resolveModelRoute } from "./model-routing";
import { getTickerLifecycle } from "./ticker-lifecycle";
import { getFundamentalsAlias, resolveFundamentalsTicker } from "./fundamentals-alias";
import {
  READINESS_DECISIONS,
  classifyAssetReadiness,
  type ReadinessInput,
  type ReadinessResult,
} from "./asset-readiness";

const CVM_ROOT = join(process.cwd(), "src/data/cvm-cache");

/** Usable fiscal years in the annual CVM cache (alias-resolved); null when no file. */
export function annualCacheYears(ticker: string): number | null {
  const p = join(CVM_ROOT, "financials", `${resolveFundamentalsTicker(ticker)}.json`);
  if (!existsSync(p)) return null;
  try {
    const parsed = JSON.parse(readFileSync(p, "utf-8")) as { financials?: unknown[] };
    return countUsableAnnualYears(parsed.financials);
  } catch {
    return 0;
  }
}

export function hasQuarterlyCache(ticker: string): boolean {
  return existsSync(join(CVM_ROOT, "quarterly", `${resolveFundamentalsTicker(ticker)}.json`));
}

export function buildReadinessInput(asset: B3Asset, universe: readonly B3Asset[] = B3_UNIVERSE): ReadinessInput {
  const lifecycle = getTickerLifecycle(asset.ticker);
  const successor = lifecycle?.successorTicker;
  return {
    ticker: asset.ticker,
    companyName: asset.companyName,
    coverageStatus: asset.coverageStatus,
    richType: classifyAsset(asset.ticker, {
      b3AssetType: asset.assetType,
      sector: asset.sector,
      companyName: asset.companyName,
    }),
    route: resolveModelRoute(asset),
    lifecycle,
    successorInUniverse: successor ? universe.some(a => a.ticker === successor) : false,
    alias: getFundamentalsAlias(asset.ticker),
    annualYears: annualCacheYears(asset.ticker),
    hasQuarterly: hasQuarterlyCache(asset.ticker),
    decision: READINESS_DECISIONS[asset.ticker] ?? null,
  };
}

export function assessAssetReadiness(asset: B3Asset): ReadinessResult {
  return classifyAssetReadiness(buildReadinessInput(asset));
}
