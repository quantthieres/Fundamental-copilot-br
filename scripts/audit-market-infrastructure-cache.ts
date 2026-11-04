/**
 * Audits the committed market-infrastructure cache
 * (src/data/market-infrastructure-cache/B3SA3.json).
 *
 * Usage:
 *   npm run market-infrastructure:audit
 *
 * Reports identity, statement history, segment validation and mix, workbook
 * quarter and its CVM revenue cross-check, CORE KPIs, operating margin,
 * EBITDA, TTM figures, gross debt, the managed net financial position and the
 * third-party memo, leverage, capital allocation, share counts, enrichment,
 * the Phase 1 readiness candidate (diagnostic only — routing is unchanged)
 * and warnings.
 *
 * Reads committed files only — no network. Exits 1 on a missing or
 * structurally invalid cache; "limited" candidates and warnings are reported,
 * not fatal.
 * Does NOT import @/ aliases — uses relative paths for tsx runtime compatibility.
 */

import { readMarketInfrastructureCache, validateMarketInfrastructureCache } from "../src/lib/market-infrastructure/market-infrastructure-cache";
import { VERIFIED_MARKET_INFRASTRUCTURE_IDENTITIES } from "../src/lib/market-infrastructure/market-infrastructure-identity";
import { assessMarketInfrastructureCache } from "../src/lib/market-infrastructure/market-infrastructure-readiness";
import type { MarketInfrastructureIndicator } from "../src/lib/market-infrastructure/market-infrastructure-types";

const brl = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `R$ ${(v / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;
const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const num = (v: number | null | undefined, digits = 3) =>
  v === null || v === undefined ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: digits });
const shares = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toLocaleString("pt-BR"));
const at = (i: MarketInfrastructureIndicator) => (i.composition.length ? ` [${i.composition.join(" ")}]` : i.reason ? ` (${i.reason})` : "");

function audit(ticker: string): string[] {
  const cache = readMarketInfrastructureCache(ticker);
  const problems = validateMarketInfrastructureCache(ticker, cache);
  console.log(`\n━━ ${ticker} ━━`);
  if (!cache) {
    console.log("  cache: MISSING");
    return problems.map(p => `${ticker}: ${p}`);
  }
  const c = cache.indicators.core;
  const s = cache.indicators.secondary;
  const st = cache.statements;
  const latest = st[st.length - 1];
  const fp = cache.financialPosition;
  const om = cache.operatingMetrics;
  const seg = c.revenueSegmentMix;
  const assessment = assessMarketInfrastructureCache(ticker, cache);

  const rows: [string, string][] = [
    ["issuer", `${cache.issuer.legalName} (${cache.issuer.tradingName}) — CVM ${cache.issuer.cvmCode} — CNPJ ${cache.issuer.cnpj} — ${cache.issuer.registration}`],
    ["share class", `${cache.shareClass.ticker} ${cache.shareClass.kind} ${cache.shareClass.isin}`],
    ["statement basis", cache.issuer.statementBasis],
    ["latest statement", latest ? `${latest.periodEnd} (${latest.document} v${latest.filingVersion}, filed ${latest.filingDate ?? "?"}, doc ${latest.cvmDocumentId ?? "?"})` : "—"],
    ["history", `${st[0]?.periodEnd ?? "—"} … ${latest?.periodEnd ?? "—"} (${st.length} statements; ${st.filter(x => x.document === "DFP").length} DFP)`],
    ["segment snapshots", cache.revenueSegments.map(x => `${x.periodKind} ${x.periodEnd}${x.source.comparative ? "*" : ""} Δ${x.reconciliation.difference}`).join(", ") || "—"],
    ["workbook quarter", om ? `${om.quarterLabel} — ${om.source.fileName} (published ${om.source.publishedDate ?? "?"}, sha256 ${om.source.sha256.slice(0, 12)}…)` : "—"],
    ["workbook vs CVM 3.01 (quarter)", om ? `${brl(om.revenueCrossCheck.workbookTotalRevenue)} vs ${brl(om.revenueCrossCheck.cvmGrossRevenueQuarter)} — Δ ${om.revenueCrossCheck.difference} (tol ${om.revenueCrossCheck.tolerance}) ${om.revenueCrossCheck.passed ? "PASS" : "FAIL"}` : "—"],
    ["official reconciliation", om ? om.officialReconciliation.map(r => `${r.label} ${r.passed === null ? "n/a" : r.passed ? "PASS" : "FAIL"}`).join("; ") : "—"],
    ["derivatives ADV", `${num(c.derivativesAdv.value, 1)} ${c.derivativesAdv.publishedUnit ?? ""}${at(c.derivativesAdv)}`],
    ["derivatives RPC", `${num(c.derivativesRpc.value, 4)} ${c.derivativesRpc.publishedUnit ?? ""}${at(c.derivativesRpc)}`],
    ["cash equities ADTV", `${num(c.cashEquitiesAdtv.value, 1)} ${c.cashEquitiesAdtv.publishedUnit ?? ""}${at(c.cashEquitiesAdtv)}`],
    ["cash equities fee margin", `${num(c.cashEquitiesFeeMarginBps.value, 3)} bps${at(c.cashEquitiesFeeMarginBps)}`],
    ["fixed income: banking instruments", `${num(c.fixedIncomeBankingInstrumentsAverageStock.value, 1)} ${c.fixedIncomeBankingInstrumentsAverageStock.publishedUnit ?? ""}${at(c.fixedIncomeBankingInstrumentsAverageStock)}`],
    ["fixed income: corporate bonds", `${num(c.fixedIncomeCorporateBondsAverageStock.value, 1)} ${c.fixedIncomeCorporateBondsAverageStock.publishedUnit ?? ""}${at(c.fixedIncomeCorporateBondsAverageStock)}`],
    ["fixed income: other", `${num(c.fixedIncomeOtherAverageStock.value, 1)} ${c.fixedIncomeOtherAverageStock.publishedUnit ?? ""}${at(c.fixedIncomeOtherAverageStock)}`],
    ["net revenue TTM", `${brl(c.netRevenueTtm.value)}${at(c.netRevenueTtm)}`],
    ["net revenue YoY (TTM)", pct(c.netRevenueYoyGrowth.value)],
    ["gross revenue (current quarter)", `${brl(c.grossRevenueCurrentPeriod.value)}${at(c.grossRevenueCurrentPeriod)}`],
    ["operating margin (TTM, B3 concept)", `${pct(c.operatingMargin.value)}${at(c.operatingMargin)}`],
    ["EBITDA TTM / margin", `${brl(c.ebitdaTtm.value)} / ${pct(c.ebitdaMargin.value)}${at(c.ebitdaTtm)}`],
    ["attributable net income TTM", `${brl(c.netIncomeAttributableTtm.value)}${at(c.netIncomeAttributableTtm)}`],
    ["one-off flag", `${cache.indicators.oneOffFlag.flagged ? "FLAGGED" : "none"} ${cache.indicators.oneOffFlag.lines.join("; ")}`],
    ["gross debt", `${brl(c.grossDebt.value)}${at(c.grossDebt)}`],
    ["managed net financial position", `${brl(c.managedNetFinancialPosition.value)}${at(c.managedNetFinancialPosition)}`],
    ["balance-sheet cash 1.01.01 (reported)", brl(fp?.balanceSheetCashReported)],
    ["cash per cash-flow statement (secondary)", `${brl(fp?.cashAndCashEquivalentsPerCashFlow)} (own-cash reading validated for: ${fp?.ownCashInterpretationValidatedFor.join(", ") || "—"})`],
    ["third-party memo: collateral received", brl(fp?.thirdPartyBalances.collateralReceived)],
    ["third-party memo: custody payments", brl(fp?.thirdPartyBalances.custodyPayments)],
    ["gross debt / EBITDA TTM", `${num(c.grossDebtToEbitdaTtm.value, 2)}x`],
    ["distributions paid TTM", `${brl(c.shareholderDistributionsTtm.value)}${at(c.shareholderDistributionsTtm)}`],
    ["buybacks TTM", `${brl(c.buybacksTtm.value)}${at(c.buybacksTtm)}`],
    ["outstanding shares", `${shares(c.outstandingSharesChange.parts?.latestOutstanding)} (${cache.referenceDates.shareCountReferenceDate ?? "—"})`],
    ["outstanding-share change (12m)", `${shares(c.outstandingSharesChange.value)} (${pct(c.outstandingSharesChange.parts?.changeRatio)})${at(c.outstandingSharesChange)}`],
    ["secondary: capex TTM / ROE / tax rate", `${brl(s.capexTtm.value)} / ${pct(s.returnOnEquity.value)} / ${pct(s.effectiveTaxRateTtm.value)}`],
    ["enrichment", `statements ${cache.enrichment.statements}, segments ${cache.enrichment.segments}, operating metrics ${cache.enrichment.operatingMetrics}`],
    ["candidate readiness (diagnostic)", `${assessment.candidate}${assessment.reasons.length ? ` — ${assessment.reasons.join("; ")}` : ""}`],
    ["updatedAt", cache.updatedAt],
  ];
  for (const [k, v] of rows) console.log(`  ${k.padEnd(40)} ${v}`);

  console.log(`  current segment mix (${seg.composition.join(" ") || "—"}):`);
  for (const l of seg.lines ?? []) console.log(`    ${l.segmentId.padEnd(36)} ${brl(l.value).padStart(18)}  ${pct(l.share).padStart(8)}  "${l.label}"`);
  const warnings = [...cache.warnings, ...cache.enrichment.issues];
  console.log(`  warnings: ${warnings.length === 0 ? "none" : ""}`);
  for (const w of warnings) console.log(`    - ${w}`);
  console.log(`  status: ${problems.length === 0 ? "OK" : `PROBLEMS — ${problems.join("; ")}`}`);
  return problems.map(p => `${ticker}: ${p}`);
}

function main(): void {
  console.log("Market-infrastructure cache audit");
  const problems = Object.keys(VERIFIED_MARKET_INFRASTRUCTURE_IDENTITIES).flatMap(audit);
  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  console.log("\nMarket-infrastructure cache structurally valid.");
}

main();
