/**
 * FII distribution-source audit — for each current cached FII: NAV and
 * distribution freshness, Fundos.Net coverage of the 12-month distribution
 * window, and how the CVM diagnostic estimate compares with Fundos.Net.
 *
 * Usage:
 *   npm run fii:audit:distributions
 *
 * Distributions come only from Fundos.Net. The CVM estimate
 * (cvmDerivedDistributionEstimate) is a diagnostic, not a fallback.
 *
 * Offline: reads src/data/fii-cache only. Exits 1 on provenance errors (a
 * distribution not sourced from Fundos.Net, a Fundos.Net month without
 * document ids, an FNET-only month with NAV fields, missing or failed
 * enrichment) — not on discrepancies, staleness or a "preserved" refresh,
 * which are reported for review.
 */
import { B3_UNIVERSE } from "../src/data/b3-universe";
import { assessAssetReadiness } from "../src/lib/coverage/asset-readiness-inputs";
import { compareDistributionSources } from "../src/lib/fiis/fii-distributions";
import { readFiiCache } from "../src/lib/fiis/fii-cache";
import { getCurrentFiiCacheTickers } from "../src/lib/fiis/fii-coverage";
import {
  FII_MAX_DISTRIBUTION_LAG_MONTHS,
  computeFiiIndicators,
  distributionLagMonths,
  distributionWindowMonths,
  latestDistributionReferenceMonth,
  latestRecordWithNav,
} from "../src/lib/fiis/fii-indicators";

interface Row {
  ticker: string;
  latestNavMonth: string;
  latestDistributionMonth: string;
  lag: string;
  window: string;
  fnetMonthsLatest12: number;
  missingDistributionMonths: number;
  coverage: number;
  cvmDiagnosticEstimateMonths: number;
  material: number;
  amortizationMonths: number;
  readiness: string;
}

const errors: string[] = [];
const discrepancies: string[] = [];
const missingDetail: string[] = [];
const notices: string[] = [];
const rows: Row[] = [];

for (const ticker of getCurrentFiiCacheTickers()) {
  const cache = readFiiCache(ticker);
  if (!cache || !cache.available) {
    errors.push(`${ticker}: cache missing or unavailable`);
    continue;
  }
  const records = cache.records;
  const enrichment = cache.distributionEnrichment;
  if (!enrichment) errors.push(`${ticker}: no distributionEnrichment block (precompute predates Fundos.Net)`);
  else if (enrichment.status === "failed") errors.push(`${ticker}: Fundos.Net enrichment failed — ${enrichment.issues[0] ?? "no reason"}`);
  else if (enrichment.status === "preserved") notices.push(`${ticker}: ${enrichment.issues[0] ?? "Fundos.Net unavailable; prior distributions preserved"}`);

  for (const r of records) {
    const m = r.referenceDate.slice(0, 7);
    if (r.monthlyDistributionPerShare != null && r.distributionSource !== "fnet_structured") errors.push(`${ticker} ${m}: distribution not sourced from Fundos.Net`);
    if (r.distributionSource === "fnet_structured" && !(r.fnetDocumentIds?.length)) errors.push(`${ticker} ${m}: Fundos.Net month without document ids`);
    if (r.source === "fii_fnet_only" && (r.netAssetValue != null || r.netAssetValuePerShare != null || r.quotaCount != null)) {
      errors.push(`${ticker} ${m}: Fundos.Net-only month carries NAV fields`);
    }
  }

  const byMonth = new Map(records.map(r => [r.referenceDate.slice(0, 7), r]));
  const window = distributionWindowMonths(records);
  const inWindow = window.map(m => byMonth.get(m));
  const missing = window.filter(m => byMonth.get(m)?.monthlyDistributionPerShare == null);
  if (missing.length) missingDetail.push(`${ticker}: ${missing.join(", ")}`);

  let material = 0;
  for (const r of inWindow) {
    const fnet = r?.monthlyDistributionPerShare;
    const cvm = r?.cvmDerivedDistributionEstimate;
    if (!r || fnet == null || cvm == null) continue;
    if (compareDistributionSources(fnet, cvm) === "material") {
      material++;
      discrepancies.push(`${ticker} ${r.referenceDate.slice(0, 7)}: Fundos.Net ${fnet} vs CVM estimate ${cvm.toFixed(4)} (${(((cvm - fnet) / (fnet || 1)) * 100).toFixed(1)}%)`);
    }
  }

  const asset = B3_UNIVERSE.find(a => a.ticker === ticker);
  rows.push({
    ticker,
    latestNavMonth: latestRecordWithNav(records)?.referenceDate.slice(0, 7) ?? "—",
    latestDistributionMonth: latestDistributionReferenceMonth(records) ?? "—",
    lag: (() => {
      const lag = distributionLagMonths(records);
      return lag === null ? "—" : `${lag}${lag > FII_MAX_DISTRIBUTION_LAG_MONTHS ? " STALE" : ""}`;
    })(),
    window: window.length ? `${window[0]}..${window[window.length - 1]}` : "—",
    fnetMonthsLatest12: inWindow.filter(r => r?.distributionSource === "fnet_structured").length,
    missingDistributionMonths: missing.length,
    coverage: computeFiiIndicators(records, null)?.distributionCoverageMonths ?? 0,
    cvmDiagnosticEstimateMonths: inWindow.filter(r => r?.cvmDerivedDistributionEstimate != null).length,
    material,
    amortizationMonths: inWindow.filter(r => r?.monthlyAmortizationPerShare != null).length,
    readiness: asset ? assessAssetReadiness(asset).readiness : "not in universe",
  });
}

const cols: [keyof Row, string][] = [
  ["ticker", "Ticker"], ["latestNavMonth", "NAV"], ["latestDistributionMonth", "Dist"], ["lag", "Lag"],
  ["window", "Window"], ["fnetMonthsLatest12", "FNET12"], ["missingDistributionMonths", "Missing"],
  ["coverage", "Coverage"], ["cvmDiagnosticEstimateMonths", "CVMdiag"], ["material", "Material"],
  ["amortizationMonths", "Amort"], ["readiness", "Readiness"],
];
const width = (k: keyof Row, h: string) => Math.max(h.length, ...rows.map(r => String(r[k]).length));
console.log("\nFII distributions — 12-month window ending at the latest Fundos.Net reference month");
console.log(`NAV = latest CVM NAV month · Dist = latest distribution month · Lag = NAV − Dist in months (stale above ${FII_MAX_DISTRIBUTION_LAG_MONTHS}) · CVMdiag = months with a CVM diagnostic estimate (not counted)\n`);
console.log(cols.map(([k, h]) => h.padEnd(width(k, h))).join("  "));
for (const r of rows) console.log(cols.map(([k, h]) => String(r[k]).padEnd(width(k, h))).join("  "));

if (notices.length) {
  console.log("\nFundos.Net unavailable at the last refresh (distributions carried over from the previous cache):");
  for (const n of notices) console.log(`  ${n}`);
}

console.log(`\nMissing distribution months in the window: ${missingDetail.length ? "" : "none"}`);
for (const d of missingDetail) console.log(`  ${d}`);

console.log(`\nCVM diagnostic estimate vs Fundos.Net, material (> 2%): ${discrepancies.length}`);
for (const d of discrepancies) console.log(`  ${d}`);

if (errors.length > 0) {
  console.error(`\nProvenance errors: ${errors.length}`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log("\nNo provenance errors.");
