// Read-only coverage profile endpoint. Returns AssetCoverageProfile for any
// ticker. Checks local cache file existence — never calls live CVM pipelines
// or computes forecasts. Always returns 200 (even when coverage is unavailable).
//
// Response: { coverage, lifecycle, readiness, fundamentalsAlias }
//   coverage          — unchanged AssetCoverageProfile (existing consumers)
//   lifecycle         — ticker lifecycle (active / renamed / … + successor)
//   readiness         — product readiness (null for tickers outside the universe)
//   fundamentalsAlias — set when fundamentals come from a same-issuer ticker

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { existsSync } from "fs";
import { join } from "path";
import { B3_UNIVERSE } from "@/data/b3-universe";
import { getCvmCompanyByTicker } from "@/lib/cvm/company-map";
import { classifyAsset } from "@/lib/coverage/asset-classifier";
import { resolveAssetCoverage } from "@/lib/coverage/coverage-resolver";
import { fundamentalsAliasMeta, resolveFundamentalsTicker } from "@/lib/coverage/fundamentals-alias";
import { getTickerLifecycle } from "@/lib/coverage/ticker-lifecycle";
import { assessAssetReadiness } from "@/lib/coverage/asset-readiness-inputs";

const CWD = process.cwd();

function cacheExists(subdir: string, ticker: string): boolean {
  try {
    return existsSync(join(CWD, subdir, `${ticker}.json`));
  } catch {
    return false;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (!ticker) {
    return NextResponse.json(
      { error: "Missing ticker" },
      { status: 400 },
    );
  }

  const b3Entry    = B3_UNIVERSE.find(a => a.ticker === ticker);
  // Same-issuer aliases read the canonical ticker's CVM mapping and caches.
  const fundamentalsTicker = resolveFundamentalsTicker(ticker);
  const cvmCompany = getCvmCompanyByTicker(fundamentalsTicker);

  const hasAnnualFinancials    = cacheExists("src/data/cvm-cache/financials",              fundamentalsTicker);
  const hasQuarterlyFinancials = cacheExists("src/data/cvm-cache/quarterly",               fundamentalsTicker);
  const hasTimeSeries          = cacheExists("src/data/forecast-cache/time-series",        fundamentalsTicker);
  const hasBaselineForecast    = cacheExists("src/data/forecast-cache/baseline-forecasts", fundamentalsTicker);

  const assetType = classifyAsset(ticker, {
    b3AssetType: b3Entry?.assetType,
    sector:      b3Entry?.sector,
    companyName: b3Entry?.companyName,
  });

  const coverage = resolveAssetCoverage({
    ticker,
    assetType,
    // B3-listed assets are tradeable; assume brapi coverage for all in universe.
    hasMarketData:       b3Entry !== undefined || cvmCompany !== null,
    hasCvmCompany:       cvmCompany !== null || (b3Entry?.hasCvmMapping ?? false),
    hasAnnualFinancials,
    hasQuarterlyFinancials,
    hasTimeSeries,
    hasBaselineForecast,
    companyName: b3Entry?.companyName ?? cvmCompany?.companyName,
    sector:      b3Entry?.sector,
    declaredStatus: b3Entry?.coverageStatus,
  });

  const lifecycle = getTickerLifecycle(ticker);
  return NextResponse.json({
    coverage,
    lifecycle: lifecycle ?? { ticker, status: "active" },
    readiness: b3Entry ? assessAssetReadiness(b3Entry) : null,
    fundamentalsAlias: fundamentalsAliasMeta(ticker),
  });
}
