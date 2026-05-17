// Read-only coverage profile endpoint. Returns AssetCoverageProfile for any
// ticker. Checks local cache file existence — never calls live CVM pipelines
// or computes forecasts. Always returns 200 (even when coverage is unavailable).

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { existsSync } from "fs";
import { join } from "path";
import { B3_UNIVERSE } from "@/data/b3-universe";
import { getCvmCompanyByTicker } from "@/lib/cvm/company-map";
import { classifyAsset } from "@/lib/coverage/asset-classifier";
import { resolveAssetCoverage } from "@/lib/coverage/coverage-resolver";

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
  const cvmCompany = getCvmCompanyByTicker(ticker);

  const hasAnnualFinancials    = cacheExists("src/data/cvm-cache/financials",              ticker);
  const hasQuarterlyFinancials = cacheExists("src/data/cvm-cache/quarterly",               ticker);
  const hasTimeSeries          = cacheExists("src/data/forecast-cache/time-series",        ticker);
  const hasBaselineForecast    = cacheExists("src/data/forecast-cache/baseline-forecasts", ticker);

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
  });

  return NextResponse.json({ coverage });
}
