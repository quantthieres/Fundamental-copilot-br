/**
 * CVM Coverage Gap Audit — identifies quote_only tickers and classifies them
 * as likely operating companies, sector-specific, or unknown.
 *
 * Usage:
 *   npm run coverage:audit:cvm-gaps
 *
 * Fully offline — reads B3_UNIVERSE and company-map only.
 * Does NOT download CVM data, call brapi, or invoke live pipelines.
 */

import { join } from "path";
import { existsSync } from "fs";

import { B3_UNIVERSE }           from "../src/data/b3-universe";
import { CVM_COMPANY_MAP }       from "../src/lib/cvm/company-map";
import { classifyAsset }         from "../src/lib/coverage/asset-classifier";
import { resolveAssetCoverage }  from "../src/lib/coverage/coverage-resolver";

const CWD = join(__dirname, "..");

function cacheExists(subdir: string, ticker: string): boolean {
  try {
    return existsSync(join(CWD, subdir, `${ticker}.json`));
  } catch {
    return false;
  }
}

// ─── Classify all quote_only tickers ─────────────────────────────────────────

const SECTOR_SPECIFIC_SECTORS = new Set([
  "Bancário", "Seguros", "Holding Financeira", "Financeiro",
]);

function isSectorSpecificByMetadata(sector: string, assetType: string): boolean {
  return (
    SECTOR_SPECIFIC_SECTORS.has(sector) ||
    assetType === "fii" ||
    assetType === "etf" ||
    assetType === "bdr"
  );
}

const quoteOnlyAssets = B3_UNIVERSE.filter(a => a.coverageStatus === "quote_only");

interface GapEntry {
  ticker: string;
  companyName: string;
  tradingName: string;
  sector: string;
  subsector: string;
  assetType: string;
  hasCvmMapping: boolean;
  inCompanyMap: boolean;
  likelySectorSpecific: boolean;
  assetTypeClassified: string;
}

const gaps: GapEntry[] = quoteOnlyAssets.map(a => {
  const classified = classifyAsset(a.ticker, {
    b3AssetType: a.assetType,
    sector:      a.sector,
    companyName: a.companyName,
  });

  return {
    ticker:               a.ticker,
    companyName:          a.companyName,
    tradingName:          a.tradingName,
    sector:               a.sector,
    subsector:            a.subsector,
    assetType:            a.assetType,
    hasCvmMapping:        a.hasCvmMapping,
    inCompanyMap:         CVM_COMPANY_MAP[a.ticker] !== undefined,
    likelySectorSpecific: isSectorSpecificByMetadata(a.sector, a.assetType),
    assetTypeClassified:  classified,
  };
});

const operatingCandidates = gaps.filter(g =>
  !g.likelySectorSpecific &&
  !g.inCompanyMap &&
  (g.assetTypeClassified === "common_stock" ||
   g.assetTypeClassified === "preferred_stock" ||
   g.assetTypeClassified === "unit"),
);

const sectorSpecificGaps = gaps.filter(g => g.likelySectorSpecific && !g.inCompanyMap);
const alreadyMapped      = gaps.filter(g => g.inCompanyMap);
const unknown            = gaps.filter(g =>
  !g.likelySectorSpecific && !g.inCompanyMap &&
  g.assetTypeClassified !== "common_stock" &&
  g.assetTypeClassified !== "preferred_stock" &&
  g.assetTypeClassified !== "unit",
);

// ─── Per-sector grouping for operating candidates ─────────────────────────────

const bySector: Record<string, GapEntry[]> = {};
for (const g of operatingCandidates) {
  if (!bySector[g.sector]) bySector[g.sector] = [];
  bySector[g.sector].push(g);
}

// ─── Report ───────────────────────────────────────────────────────────────────

const SEP = "━".repeat(64);

console.log(`\n${SEP}`);
console.log("  CVM Coverage Gap Audit");
console.log(`  ${new Date().toISOString()}`);
console.log(`${SEP}\n`);

console.log(`Total quote_only tickers: ${quoteOnlyAssets.length}`);
console.log(`  Operating company candidates (no CVM map yet): ${operatingCandidates.length}`);
console.log(`  Already mapped (hasCvmMapping=false but in company-map): ${alreadyMapped.length}`);
console.log(`  Likely sector-specific (banks, FIIs, ETFs, etc.): ${sectorSpecificGaps.length}`);
console.log(`  Unknown / unclassified: ${unknown.length}\n`);

// ─── Operating candidates by sector ──────────────────────────────────────────

console.log("Operating company candidates by sector (CVM mapping not yet verified):");
for (const [sector, entries] of Object.entries(bySector).sort((a, b) => b[1].length - a[1].length)) {
  const tickers = entries.map(e => e.ticker).join(", ");
  const pad     = " ".repeat(Math.max(0, 35 - sector.length));
  console.log(`  ${sector}${pad} (${entries.length}): ${tickers}`);
}

// ─── Already mapped ───────────────────────────────────────────────────────────

if (alreadyMapped.length > 0) {
  console.log(`\nIn company-map but still quote_only in B3 universe (needs b3-universe update):`);
  for (const g of alreadyMapped) {
    const cvmEntry = CVM_COMPANY_MAP[g.ticker];
    console.log(`  ${g.ticker.padEnd(10)} CVM ${cvmEntry?.cvmCode ?? "?"} — ${g.companyName}`);
  }
}

// ─── Sector-specific gaps ─────────────────────────────────────────────────────

console.log(`\nSector-specific (not candidates for industrial model expansion):`);
for (const g of sectorSpecificGaps) {
  console.log(`  ${g.ticker.padEnd(10)} [${g.sector}]`);
}

// ─── Unknown ──────────────────────────────────────────────────────────────────

if (unknown.length > 0) {
  console.log(`\nUnknown/unclassified quote_only:`);
  for (const g of unknown) {
    console.log(`  ${g.ticker.padEnd(10)} [${g.assetTypeClassified}] — ${g.sector}`);
  }
}

// ─── CVM mapping candidates (priority list) ───────────────────────────────────

console.log(`\nPriority candidates for CVM mapping expansion:`);
console.log("(major, established operating companies with long CVM history expected)\n");

const PRIORITY_SECTORS = [
  "Petróleo e Gás",
  "Mineração",
  "Siderurgia",
  "Papel e Celulose",
  "Energia Elétrica",
  "Saneamento",
  "Telecomunicações",
  "Alimentos",
  "Bebidas",
  "Transporte",
  "Saúde",
  "Educação",
  "Varejo",
  "Tecnologia",
  "Bens de Capital",
  "Químicos",
];

for (const sector of PRIORITY_SECTORS) {
  const entries = bySector[sector] ?? [];
  if (entries.length === 0) continue;
  console.log(`  ${sector}:`);
  for (const g of entries) {
    console.log(`    ${g.ticker.padEnd(10)} ${g.companyName}`);
  }
}

// ─── Cache status for currently full_analysis tickers ─────────────────────────

const fullAnalysis = B3_UNIVERSE.filter(a => a.coverageStatus === "full_analysis" || a.coverageStatus === "cvm_analysis");
const withAllCaches = fullAnalysis.filter(a =>
  cacheExists("src/data/cvm-cache/financials", a.ticker) &&
  cacheExists("src/data/forecast-cache/baseline-forecasts", a.ticker),
);

console.log(`\nCurrent analysis-ready tickers: ${fullAnalysis.length}`);
console.log(`With all caches (annual + forecast): ${withAllCaches.length}`);

console.log(`\n${SEP}\n`);
