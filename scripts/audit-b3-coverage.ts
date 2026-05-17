/**
 * B3 Coverage Audit — reports coverage profile for all known tickers.
 *
 * Usage:
 *   npm run coverage:audit
 *
 * Checks local cache file existence — does NOT download CVM data, call brapi,
 * or invoke any live pipeline. Safe to run at any time, offline.
 */

import { existsSync } from "fs";
import { join } from "path";

import { B3_UNIVERSE }           from "../src/data/b3-universe";
import { getCvmCompanyByTicker } from "../src/lib/cvm/company-map";
import { classifyAsset }         from "../src/lib/coverage/asset-classifier";
import { resolveAssetCoverage }  from "../src/lib/coverage/coverage-resolver";
import type { AssetCoverageProfile } from "../src/lib/coverage/coverage-types";

// ─── Cache helpers ─────────────────────────────────────────────────────────────

const CWD = join(__dirname, "..");

function cacheExists(subdir: string, ticker: string): boolean {
  try {
    return existsSync(join(CWD, subdir, `${ticker}.json`));
  } catch {
    return false;
  }
}

// ─── Build profiles ────────────────────────────────────────────────────────────

const profiles: AssetCoverageProfile[] = [];

for (const asset of B3_UNIVERSE) {
  const cvmCompany = getCvmCompanyByTicker(asset.ticker);

  const hasAnnualFinancials    = cacheExists("src/data/cvm-cache/financials",              asset.ticker);
  const hasQuarterlyFinancials = cacheExists("src/data/cvm-cache/quarterly",               asset.ticker);
  const hasTimeSeries          = cacheExists("src/data/forecast-cache/time-series",        asset.ticker);
  const hasBaselineForecast    = cacheExists("src/data/forecast-cache/baseline-forecasts", asset.ticker);

  const assetType = classifyAsset(asset.ticker, {
    b3AssetType: asset.assetType,
    sector:      asset.sector,
    companyName: asset.companyName,
  });

  const profile = resolveAssetCoverage({
    ticker:    asset.ticker,
    assetType,
    hasMarketData:       true, // all B3 universe assets are traded on B3
    hasCvmCompany:       cvmCompany !== null || asset.hasCvmMapping,
    hasAnnualFinancials,
    hasQuarterlyFinancials,
    hasTimeSeries,
    hasBaselineForecast,
    companyName: asset.companyName,
    sector:      asset.sector,
  });

  profiles.push(profile);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countBy<K extends string>(items: AssetCoverageProfile[], key: (p: AssetCoverageProfile) => K): Record<K, number> {
  const acc = {} as Record<K, number>;
  for (const p of items) {
    const k = key(p);
    acc[k] = (acc[k] ?? 0) + 1;
  }
  return acc;
}

function pad(s: string, w: number): string {
  return s.length >= w ? s : s + " ".repeat(w - s.length);
}

// ─── Report ───────────────────────────────────────────────────────────────────

const SEP = "━".repeat(58);

console.log(`\n${SEP}`);
console.log("  B3 Coverage Audit");
console.log(`  ${new Date().toISOString()}`);
console.log(`${SEP}\n`);

console.log(`Total tickers evaluated: ${profiles.length}\n`);

// By asset type
const byType = countBy(profiles, p => p.assetType);
console.log("By asset type:");
for (const [type, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${pad(type, 22)} ${n}`);
}

// By coverage level
const byLevel = countBy(profiles, p => p.coverageLevel);
console.log("\nBy coverage level:");
for (const [level, n] of Object.entries(byLevel).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${pad(level, 38)} ${n}`);
}

// By reason code
const byReason = countBy(profiles, p => p.reasonCode);
console.log("\nBy reason code:");
for (const [reason, n] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${pad(reason, 38)} ${n}`);
}

// Examples per coverage level (up to 6 per bucket)
console.log("\nExamples by coverage level:");
const grouped: Record<string, string[]> = {};
for (const p of profiles) {
  if (!grouped[p.coverageLevel]) grouped[p.coverageLevel] = [];
  if (grouped[p.coverageLevel].length < 6) grouped[p.coverageLevel].push(p.ticker);
}
for (const [level, tickers] of Object.entries(grouped)) {
  console.log(`  ${pad(level + ":", 38)} ${tickers.join(", ")}`);
}

// Forecast-eligible tickers
const forecastEligible = profiles.filter(p => p.isForecastEligible).map(p => p.ticker);
console.log(`\nForecast-eligible tickers (${forecastEligible.length}): ${forecastEligible.slice(0, 10).join(", ")}${forecastEligible.length > 10 ? ` ... +${forecastEligible.length - 10} more` : ""}`);

console.log(`\n${SEP}\n`);
