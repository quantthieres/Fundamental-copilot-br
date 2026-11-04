/**
 * Precomputes the market-infrastructure cache (B3SA3 only) and writes
 * src/data/market-infrastructure-cache/B3SA3.json.
 *
 * Usage:
 *   npm run market-infrastructure:precompute
 *
 * Sources (precompute time only; nothing reads them at runtime):
 *   - CVM registry (identity: CD_CVM + CNPJ, ATIVO);
 *   - CVM DFP/ITR consolidated statements (FY2019 onward) and composicao_capital;
 *   - B3 RI quarterly-data workbook (MZiQ file-manager listing + XLSX).
 *
 * CVM and B3 RI are handled independently: a failing workbook preserves the
 * previous validated KPI snapshot while statements advance; a failing CVM
 * download keeps the previous statement history; when both fail nothing is
 * written. Exits 1 on an identity mismatch or when nothing could be written
 * and no committed cache exists.
 *
 * Phase 1: not part of the scheduled cache refresh (.github/workflows/).
 * Does NOT touch industrial, bank, FII, insurance or holding caches.
 * Does NOT import @/ aliases — uses relative paths for tsx runtime compatibility.
 */

import { existsSync } from "fs";
import { fetchCvmCompanyRegistry } from "../src/lib/cvm/cvm-registry";
import { checkRegistryIdentity } from "../src/lib/cvm/sector-model-identities";
import { B3SA3_IDENTITY, STATEMENT_HISTORY_START_YEAR } from "../src/lib/market-infrastructure/market-infrastructure-identity";
import { loadMarketInfrastructureCvmData } from "../src/lib/market-infrastructure/market-infrastructure-cvm-client";
import { fetchB3Workbook } from "../src/lib/market-infrastructure/b3-workbook-source";
import { refreshMarketInfrastructureCache, type CvmOutcome, type SourceOutcome } from "../src/lib/market-infrastructure/market-infrastructure-refresh";
import {
  marketInfrastructureCachePath,
  readMarketInfrastructureCache,
  writeMarketInfrastructureCache,
} from "../src/lib/market-infrastructure/market-infrastructure-cache";

const CURRENT_YEAR = new Date().getUTCFullYear();
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
// Annual filings FY2019 onward and every interim filing since 2019 (TTM at each quarter).
const YEARS = {
  dfp: range(STATEMENT_HISTORY_START_YEAR, CURRENT_YEAR),
  itr: range(STATEMENT_HISTORY_START_YEAR, CURRENT_YEAR),
  optional: [{ kind: "DFP" as const, year: CURRENT_YEAR }, { kind: "ITR" as const, year: CURRENT_YEAR }],
};

async function main(): Promise<void> {
  const identity = B3SA3_IDENTITY;
  const ticker = identity.ticker;
  console.log(`\nMarket-infrastructure precompute — ${ticker} (CVM ${identity.cvmCode} / ${identity.cnpj})`);
  console.log(`CVM years: DFP ${YEARS.dfp.join(",")} | ITR ${YEARS.itr.join(",")}\n`);
  const previous = readMarketInfrastructureCache(ticker);

  const registry = await fetchCvmCompanyRegistry();
  let cvm: SourceOutcome<CvmOutcome>;
  let legalName: string | null = null;
  if (registry.length === 0) {
    cvm = { ok: false, error: "CVM registry unavailable — identity not verifiable" };
  } else {
    const problem = checkRegistryIdentity(identity, registry.map(r => ({ ...r, status: r.status ?? "" })));
    if (problem) {
      console.error(`Identity mismatch: ${problem}`);
      process.exit(1);
    }
    legalName = registry.find(r => r.cnpj.replace(/\D/g, "") === identity.cnpj.replace(/\D/g, ""))?.companyName ?? null;
    try {
      const data = await loadMarketInfrastructureCvmData(identity, YEARS);
      console.log(`  CVM: ${data.statements.length} consolidated statements, ${data.shareCounts.length} share counts (${data.rejectedParentOnlyRows} parent-only rows ignored)`);
      cvm = { ok: true, value: { statements: data.statements, filings: data.filings, shareCounts: data.shareCounts, sources: data.sources } };
    } catch (err) {
      cvm = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
  if (!cvm.ok) console.log(`  CVM: FAILED — ${cvm.error}`);

  const workbook = await fetchB3Workbook();
  console.log(workbook.ok
    ? `  Workbook: ${workbook.value.source.fileName} (${workbook.value.parsed.quarterLabel}, published ${workbook.value.source.publishedDate ?? "?"})`
    : `  Workbook: FAILED — ${workbook.error}`);

  const result = refreshMarketInfrastructureCache({ identity, legalName, previous, cvm, workbook, updatedAt: new Date().toISOString() });
  if (!result.write || !result.cache) {
    console.log(`  → ${previous ? "KEPT" : "NOT WRITTEN"} — ${result.reason}`);
    if (!existsSync(marketInfrastructureCachePath(ticker))) process.exit(1);
    return;
  }
  const file = writeMarketInfrastructureCache(result.cache);
  for (const w of result.cache.warnings) console.log(`  warning: ${w}`);
  console.log(`  → WRITTEN — ${result.reason} → ${file}`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
