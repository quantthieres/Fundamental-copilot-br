/**
 * Audits the committed holding caches (src/data/holding-cache/).
 *
 * Usage:
 *   npm run holding:audit
 *
 * Per issuer: identity vs VERIFIED_HOLDING_IDENTITIES, share classes, latest
 * parent-only statement, portfolio snapshot and its arithmetic validation,
 * official market value and discount, core holding figures, portfolio
 * freshness (source periods only) and warnings. Also checks that every ON
 * class resolves to its issuer's cache and never to another issuer.
 *
 * Reads committed files only — no network. Exits 1 on a missing or
 * inconsistent cache; stale portfolios and warnings are reported, not fatal.
 * Does NOT import @/ aliases — uses relative paths for tsx runtime compatibility.
 */

import { HOLDING_CACHE_ALIASES, VERIFIED_HOLDING_IDENTITIES } from "../src/lib/holdings/holding-identities";
import { readHoldingCache } from "../src/lib/holdings/holding-cache";
import { hasHoldingAnalysisCache } from "../src/lib/holdings/holding-coverage";
import { holdingNetDebt } from "../src/lib/holdings/holding-indicators";
import type { HoldingCache } from "../src/lib/holdings/holding-types";

const brl = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const shares = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR"));

function problemsOf(ticker: string, cache: HoldingCache | null): string[] {
  const id = VERIFIED_HOLDING_IDENTITIES[ticker];
  if (!cache) return ["cache file missing or unreadable"];
  const p: string[] = [];
  if (cache.ticker !== ticker) p.push(`cache ticker ${cache.ticker}`);
  if (cache.issuer.cvmCode !== id.cvmCode) p.push(`CVM code ${cache.issuer.cvmCode} ≠ ${id.cvmCode}`);
  if (cache.issuer.cnpj !== id.cnpj) p.push(`CNPJ ${cache.issuer.cnpj} ≠ ${id.cnpj}`);
  if (cache.issuer.statementBasis !== "individual" || cache.statements.some(s => s.basis !== "individual")) p.push("non-individual statement basis");
  const expectedClasses = id.shareClasses.map(c => c.ticker).join(",");
  if (cache.shareClasses.map(c => c.ticker).join(",") !== expectedClasses) p.push(`share classes ≠ ${expectedClasses}`);
  if (!cache.latestStatement) p.push("no statements");
  if (!cache.portfolio) p.push("no portfolio snapshot");
  else if (cache.portfolio.validation.status !== "passed") p.push("portfolio arithmetic validation not passed");
  return p;
}

function report(ticker: string): string[] {
  const cache = readHoldingCache(ticker);
  const problems = problemsOf(ticker, cache);
  console.log(`\n━━ ${ticker} ━━`);
  if (!cache) {
    console.log("  cache: MISSING");
    return problems.map(x => `${ticker}: ${x}`);
  }
  const latest = cache.statements[cache.statements.length - 1] ?? null;
  const pf = cache.portfolio;
  const i = cache.indicators.core;
  const rows: [string, string][] = [
    ["canonical ticker", cache.ticker],
    ["issuer", `${cache.issuer.legalName} — CVM ${cache.issuer.cvmCode} — CNPJ ${cache.issuer.cnpj}`],
    ["latest statement", latest ? `${latest.periodEnd} (${latest.document} v${latest.filingVersion}, filed ${latest.filingDate ?? "?"})` : "—"],
    ["statement basis", cache.issuer.statementBasis],
    ["statements in history", String(cache.statements.length)],
    ["portfolio reference date", pf?.portfolioReferenceDate ?? "—"],
    ["portfolio publication", pf?.portfolioPublicationDate ?? "—"],
    ["portfolio source", pf ? `${pf.source.title} — ${pf.source.url}` : "—"],
    ["component count", pf ? String(pf.components.length) : "—"],
    ["portfolio total (official)", brl(pf?.officialPortfolioValue)],
    ["official market value", pf ? `${brl(pf.officialMarketValue.value)} (${pf.officialMarketValue.method})` : "—"],
    ["official discount", pf ? `${pct(pf.officialDiscount.value)} (published "${pf.officialDiscount.published}")` : "—"],
    ["largest investee / Σ positive investees", `${pct(i.largestInvesteeConcentration.value)} (${i.largestInvesteeConcentration.investee ?? "—"})`],
    ["statement cash", `${brl(i.holdingCash.value)} (${latest?.periodEnd ?? "—"})`],
    ["statement gross debt", `${brl(i.grossDebt.value)} (${latest?.periodEnd ?? "—"})`],
    ["statement net debt", `${brl(holdingNetDebt(latest))} (${latest?.periodEnd ?? "—"})`],
    ["published net cash (portfolio)", pf?.publishedNetCash
      ? `${brl(pf.publishedNetCash.value)} (${pf.publishedNetCash.referenceDate}; input to official portfolio value only)` : "—"],
    ["TTM dividends received", `${brl(i.dividendsReceivedTtm.value)} [${i.dividendsReceivedTtm.asOf.join(", ")}]`],
    ["portfolio freshness", `${cache.portfolioFreshness.status} (lag ${cache.portfolioFreshness.quarterLag ?? "?"} quarter(s))`],
    ["arithmetic validation", pf ? `${pf.validation.status} (${pf.validation.checks.filter(c => c.passed).length}/${pf.validation.checks.length} checks)` : "—"],
    ["enrichment", `statements ${cache.enrichment.statements}, portfolio ${cache.enrichment.portfolio}`],
  ];
  for (const [k, v] of rows) console.log(`  ${k.padEnd(40)} ${v}`);

  console.log("  share classes:");
  for (const c of cache.shareClasses) {
    console.log(`    ${c.ticker} ${c.kind} ${c.isin}  issued ${shares(c.issuedShares)}  treasury ${shares(c.treasuryShares)}  outstanding ${shares(c.outstandingShares)}  (${c.referenceDate ?? "?"})`);
  }
  if (pf) {
    console.log("  components:");
    for (const c of pf.components) {
      console.log(`    ${c.name.padEnd(28)} ${brl(c.value).padStart(16)}  ${c.valueBasis.padEnd(27)} ${c.valueReferenceDate ?? "—"}  ${c.ticker ?? ""}`);
    }
  }
  const warnings = [...cache.warnings, ...cache.enrichment.issues, ...(pf?.diagnostics ?? [])];
  console.log(`  warnings: ${warnings.length === 0 ? "none" : ""}`);
  for (const w of warnings) console.log(`    - ${w}`);
  console.log(`  status: ${problems.length === 0 ? "OK" : `PROBLEMS — ${problems.join("; ")}`}`);
  return problems.map(x => `${ticker}: ${x}`);
}

function main(): void {
  console.log("Holding cache audit");
  const problems: string[] = [];
  for (const ticker of Object.keys(VERIFIED_HOLDING_IDENTITIES)) {
    if (!hasHoldingAnalysisCache(ticker)) problems.push(`${ticker}: not registered in holding-coverage.ts`);
    problems.push(...report(ticker));
  }

  console.log("\n━━ Share-class cache resolution ━━");
  for (const [alias, canonical] of Object.entries(HOLDING_CACHE_ALIASES)) {
    const cache = readHoldingCache(alias);
    const ok = cache?.ticker === canonical && cache.issuer.cvmCode === VERIFIED_HOLDING_IDENTITIES[canonical].cvmCode;
    console.log(`  ${alias} → ${cache?.ticker ?? "none"} ${ok ? "OK" : "WRONG"}`);
    if (!ok) problems.push(`${alias}: does not resolve to the ${canonical} issuer cache`);
  }
  for (const other of ["ITUB4", "ITUB3", "VALE3"]) {
    const cache = readHoldingCache(other);
    console.log(`  ${other} → ${cache ? cache.ticker : "none"} ${cache ? "WRONG" : "OK"}`);
    if (cache) problems.push(`${other} must not resolve to a holding cache`);
  }

  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log("\nAll holding caches consistent.");
}

main();
