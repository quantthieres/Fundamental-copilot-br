// Market-infrastructure cache I/O and structural validation. Server-side /
// scripts only — reads committed JSON, never B3 RI or CVM.
//
// One file per issuer: src/data/market-infrastructure-cache/B3SA3.json.
// Phase 1: written and audited only; no route or page consumes it yet.
//
// No @/ imports — also used by tsx scripts.

import fs from "fs";
import path from "path";
import { getMarketInfrastructureIdentity } from "./market-infrastructure-identity";
import {
  CORE_INDICATOR_KEYS,
  MARKET_INFRASTRUCTURE_CACHE_SCHEMA_VERSION,
  SECONDARY_INDICATOR_KEYS,
  type MarketInfrastructureCache,
} from "./market-infrastructure-types";

export const MARKET_INFRASTRUCTURE_CACHE_DIR = path.join(process.cwd(), "src/data/market-infrastructure-cache");

export function marketInfrastructureCachePath(ticker: string, dir = MARKET_INFRASTRUCTURE_CACHE_DIR): string {
  return path.join(dir, `${ticker.toUpperCase()}.json`);
}

/** Cache of a covered market-infrastructure issuer (B3SA3 only), else null. */
export function readMarketInfrastructureCache(ticker: string, dir = MARKET_INFRASTRUCTURE_CACHE_DIR): MarketInfrastructureCache | null {
  const identity = getMarketInfrastructureIdentity(ticker);
  if (!identity) return null;
  try {
    return JSON.parse(fs.readFileSync(marketInfrastructureCachePath(identity.ticker, dir), "utf-8")) as MarketInfrastructureCache;
  } catch {
    return null;
  }
}

/** Stable serialization: key order follows the builders; only updatedAt varies. */
export function serializeMarketInfrastructureCache(cache: MarketInfrastructureCache): string {
  return `${JSON.stringify(cache, null, 2)}\n`;
}

export function writeMarketInfrastructureCache(cache: MarketInfrastructureCache, dir = MARKET_INFRASTRUCTURE_CACHE_DIR): string {
  fs.mkdirSync(dir, { recursive: true });
  const file = marketInfrastructureCachePath(cache.ticker, dir);
  fs.writeFileSync(file, serializeMarketInfrastructureCache(cache), "utf-8");
  return file;
}

/** Indicator keys that must never appear in this model (industrial / valuation / derived). */
export const FORBIDDEN_INDICATOR_PATTERN =
  /gross.?margin|margem.?bruta|net.?debt|divida.?liquida|free.?cash|fcf|cfo|ev.?ebit|ev.?revenue|enterprise|p.?l\b|price.?earnings|roic|tangible|take.?rate|fair.?value|target|upside|downside|recommend/i;

/**
 * Structural problems of a cache (audit exits non-zero on any). Data gaps
 * that the readiness diagnostic reports as "limited" are not problems.
 */
export function validateMarketInfrastructureCache(ticker: string, cache: MarketInfrastructureCache | null): string[] {
  const identity = getMarketInfrastructureIdentity(ticker);
  if (!identity) return [`${ticker} is not a market-infrastructure issuer`];
  if (!cache) return ["cache file missing or unreadable"];
  const p: string[] = [];
  if (cache.schemaVersion !== MARKET_INFRASTRUCTURE_CACHE_SCHEMA_VERSION) p.push(`schema version ${cache.schemaVersion}`);
  if (cache.ticker !== identity.ticker || cache.source !== "market_infrastructure_analysis") p.push("ticker/source mismatch");
  if (cache.issuer?.cvmCode !== identity.cvmCode || cache.issuer?.cnpj !== identity.cnpj) p.push("issuer identity does not match the verified registry");
  if (cache.shareClass?.ticker !== identity.ticker || cache.shareClass?.isin !== identity.isin) p.push("share class does not match the verified identity");
  if (cache.issuer?.statementBasis !== "consolidated" || cache.statements?.some(s => s.basis !== "consolidated")) p.push("non-consolidated statement basis");
  if (!Array.isArray(cache.statements) || cache.statements.length === 0) p.push("no statements");
  else {
    const ends = cache.statements.map(s => s.periodEnd);
    if (ends.some((e, i) => i > 0 && e <= ends[i - 1])) p.push("statement history not strictly ordered");
    const latest = cache.statements[cache.statements.length - 1];
    if (cache.latestStatement?.periodEnd !== latest.periodEnd) p.push("latestStatement does not match the statement history");
  }
  for (const s of cache.revenueSegments ?? []) {
    if (!s.reconciliation?.passed) p.push(`segment snapshot ${s.periodKind} ${s.periodEnd} stored without a passed reconciliation`);
    if (!["quarter", "ytd", "fy"].includes(s.periodKind)) p.push(`segment snapshot with unapproved period kind ${s.periodKind}`);
  }
  if (cache.operatingMetrics && !cache.operatingMetrics.revenueCrossCheck?.passed) p.push("operating metrics stored without a passed revenue cross-check");
  if (cache.operatingMetrics && !cache.statements?.some(s => s.periodEnd === cache.operatingMetrics!.quarterEnd)) p.push("operating metrics quarter has no statement");
  const core = Object.keys(cache.indicators?.core ?? {});
  const secondary = Object.keys(cache.indicators?.secondary ?? {});
  if (core.join(",") !== CORE_INDICATOR_KEYS.join(",")) p.push(`core indicator keys ≠ ${CORE_INDICATOR_KEYS.join(",")}`);
  if (secondary.join(",") !== SECONDARY_INDICATOR_KEYS.join(",")) p.push(`secondary indicator keys ≠ ${SECONDARY_INDICATOR_KEYS.join(",")}`);
  const forbidden = [...core, ...secondary].filter(k => FORBIDDEN_INDICATOR_PATTERN.test(k));
  if (forbidden.length > 0) p.push(`forbidden indicators: ${forbidden.join(", ")}`);
  if (!["ok", "preserved", "failed"].includes(cache.enrichment?.statements)) p.push("enrichment status missing");
  if (typeof cache.updatedAt !== "string" || Number.isNaN(Date.parse(cache.updatedAt))) p.push("updatedAt missing");
  return p;
}
