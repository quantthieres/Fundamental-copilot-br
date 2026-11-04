/**
 * Precomputes the holding caches (Itaúsa, Bradespar) and writes
 * src/data/holding-cache/<CANONICAL>.json — one file per issuer.
 *
 * Usage:
 *   npm run holding:precompute
 *   HOLDING_PRECOMPUTE_TICKERS=BRAP3 npm run holding:precompute   # any class → its issuer
 *
 * Sources (precompute time only; the application reads committed cache):
 *   - CVM registry (identity: CD_CVM + CNPJ, ATIVO);
 *   - CVM DFP/ITR parent-only statements and composicao_capital;
 *   - Itaúsa "Valor do Portfólio e Desconto" page (HTML);
 *   - Bradespar Boletim Quinzenal (AEM listing JSON + one-page PDF text).
 *
 * Per issuer: a failing portfolio source preserves the previous validated
 * snapshot while CVM statements still advance; a failing CVM download keeps
 * the previous statement history; when both fail nothing is written. Exits 1
 * on an identity mismatch or when an issuer could not be written at all and
 * has no committed cache. Not part of the scheduled workflow yet.
 *
 * Does NOT touch industrial, bank, FII or insurance caches.
 * Does NOT import @/ aliases — uses relative paths for tsx runtime compatibility.
 */

import { existsSync } from "fs";
import { fetchCvmCompanyRegistry } from "../src/lib/cvm/cvm-registry";
import { checkRegistryIdentity } from "../src/lib/cvm/sector-model-identities";
import { readTickerFilter } from "./ticker-filter";
import { VERIFIED_HOLDING_IDENTITIES, resolveHoldingCacheTicker, type HoldingIdentity } from "../src/lib/holdings/holding-identities";
import { loadHoldingCvmData } from "../src/lib/holdings/holding-cvm-client";
import { fetchBradesparPortfolio, fetchItausaPortfolio } from "../src/lib/holdings/holding-portfolio-sources";
import { refreshHoldingCache, type CvmOutcome, type PortfolioOutcome, type SourceOutcome } from "../src/lib/holdings/holding-refresh";
import { holdingCachePath, readHoldingCache, writeHoldingCache } from "../src/lib/holdings/holding-cache";

const CURRENT_YEAR = new Date().getUTCFullYear();
// Five annual filings and the interim filings needed for TTM at every quarter.
const YEARS = {
  dfp: Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 5 + i),
  itr: [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR],
  optional: [CURRENT_YEAR],
};

const PORTFOLIO_SOURCES: Record<string, () => Promise<SourceOutcome<PortfolioOutcome>>> = {
  ITSA4: () => fetchItausaPortfolio(),
  BRAP4: () => fetchBradesparPortfolio(),
};

type Registry = Awaited<ReturnType<typeof fetchCvmCompanyRegistry>>;

interface IssuerResult {
  ticker: string;
  status: "written" | "kept" | "identity_error" | "not_written";
  detail: string;
}

async function processIssuer(identity: HoldingIdentity, registry: Registry): Promise<IssuerResult> {
  const ticker = identity.canonicalTicker;
  const previous = readHoldingCache(ticker);

  let cvm: SourceOutcome<CvmOutcome>;
  let legalName: string | null = null;
  if (registry.length === 0) {
    cvm = { ok: false, error: "CVM registry unavailable — identity not verifiable" };
  } else {
    const problem = checkRegistryIdentity(identity, registry.map(r => ({ ...r, status: r.status ?? "" })));
    if (problem) return { ticker, status: "identity_error", detail: problem };
    legalName = registry.find(r => r.cnpj.replace(/\D/g, "") === identity.cnpj.replace(/\D/g, ""))?.companyName ?? null;
    try {
      const data = await loadHoldingCvmData(identity, YEARS);
      console.log(`  CVM: ${data.statements.length} parent-only statements (${data.rejectedConsolidatedRows} consolidated rows ignored)`);
      cvm = { ok: true, value: { statements: data.statements, capital: data.capital, sources: data.sources } };
    } catch (err) {
      cvm = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
  if (!cvm.ok) console.log(`  CVM: FAILED — ${cvm.error}`);

  const portfolio = await PORTFOLIO_SOURCES[ticker]();
  console.log(portfolio.ok
    ? `  Portfolio: ${portfolio.value.portfolio.source.title} (${portfolio.value.portfolio.portfolioReferenceDate})`
    : `  Portfolio: FAILED — ${portfolio.error}`);

  const result = refreshHoldingCache({
    identity, legalName, previous, cvm, portfolio, updatedAt: new Date().toISOString(),
  });
  if (!result.write || !result.cache) {
    return { ticker, status: previous ? "kept" : "not_written", detail: result.reason };
  }
  const file = writeHoldingCache(result.cache);
  for (const w of result.cache.warnings) console.log(`  warning: ${w}`);
  return { ticker, status: "written", detail: `${result.reason} → ${file}` };
}

async function main(): Promise<void> {
  const filter = readTickerFilter("HOLDING_PRECOMPUTE_TICKERS");
  const wanted = filter ? new Set([...filter].map(t => resolveHoldingCacheTicker(t)).filter((t): t is string => !!t)) : null;
  if (filter && wanted!.size === 0) {
    console.error(`No holding issuer for HOLDING_PRECOMPUTE_TICKERS=${[...filter].join(",")}`);
    process.exit(1);
  }
  const targets = Object.values(VERIFIED_HOLDING_IDENTITIES).filter(i => !wanted || wanted.has(i.canonicalTicker));

  console.log(`\nHolding precompute — ${targets.map(t => t.canonicalTicker).join(", ")}`);
  console.log(`CVM years: DFP ${YEARS.dfp.join(",")} | ITR ${YEARS.itr.join(",")}\n`);
  const registry = await fetchCvmCompanyRegistry();

  const results: IssuerResult[] = [];
  for (const identity of targets) {
    console.log(`[${identity.canonicalTicker}] CVM ${identity.cvmCode} / ${identity.cnpj}`);
    const r = await processIssuer(identity, registry);
    console.log(`  → ${r.status.toUpperCase()} — ${r.detail}\n`);
    results.push(r);
  }

  const failed = results.filter(r => r.status === "identity_error" ||
    (r.status === "not_written" && !existsSync(holdingCachePath(r.ticker))));
  if (failed.length > 0) {
    console.error(`Holding precompute failed for: ${failed.map(r => r.ticker).join(", ")}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
