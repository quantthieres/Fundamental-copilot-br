// Generates the normalized Macro Map caches from official sources.
//   IMF World Economic Outlook (SDMX, IMF.RES:WEO) → inflation, real GDP growth,
//                                                    unemployment, gov. debt/GDP
//   BIS Central bank policy rates (SDMX, WS_CBPOL, monthly) → policy rate
// Writes: src/data/macro-cache/<indicator>.json
//
// Usage:
//   npm run macro:precompute
//
// Safety:
//   - Source payloads are kept in memory only; nothing raw is written to disk.
//   - Every dataset is validated (and compared against the existing cache)
//     before ANY file is replaced; on any failure nothing is written and the
//     script exits 1. A missing previous cache (first generation) is allowed.
//   - Files are written to a temp file and renamed into place.
//   - A dataset that differs only in generatedAt is left untouched.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import { join } from "path";
import { fetchWeo, buildWeoDataUrl } from "../src/lib/macro/weo-client";
import { fetchBisPolicyRates, buildBisPolicyRateUrl } from "../src/lib/macro/bis-client";
import {
  normalizeBisPolicyRates,
  normalizeWeoIndicator,
  type NormalizationIssues,
} from "../src/lib/macro/macro-normalizer";
import {
  compareMacroDatasets,
  countObservations,
  isSameDataIgnoringGeneratedAt,
  serializeMacroDataset,
  validateMacroDataset,
} from "../src/lib/macro/macro-cache-validation";
import { parseMacroDataset } from "../src/lib/macro/macro-cache";
import { BIS_START_YEAR, MACRO_INDICATORS, WEO_INDICATOR_IDS, WEO_START_YEAR } from "../src/lib/macro/macro-indicators";
import type { MacroIndicatorDataset } from "../src/lib/macro/macro-types";

const OUTPUT_DIR = join(process.cwd(), "src/data/macro-cache");

interface Candidate {
  dataset: MacroIndicatorDataset;
  issues: NormalizationIssues;
  errors: string[];
}

function readExisting(file: string): MacroIndicatorDataset | null {
  const path = join(OUTPUT_DIR, file);
  if (!existsSync(path)) return null;
  const ds = parseMacroDataset(readFileSync(path, "utf-8"));
  if (!ds) throw new Error(`Existing cache ${file} is unreadable; inspect it before regenerating`);
  return ds;
}

function check(dataset: MacroIndicatorDataset, issues: NormalizationIssues): Candidate {
  const errors = [
    ...issues.errors,
    ...issues.conflicts.map(c => `conflicting duplicate: ${c}`),
    ...issues.invalidValues.map(v => `invalid value: ${v}`),
    ...validateMacroDataset(dataset),
    ...compareMacroDatasets(readExisting(dataset.indicator.cacheFile), dataset),
  ];
  return { dataset, issues, errors };
}

function summarize({ dataset: ds, issues, errors }: Candidate): void {
  const years = ds.availableYears;
  console.log(
    `  ${ds.indicator.id.padEnd(16)} countries=${String(ds.countries.length).padStart(3)}` +
    `  years=${years[0]}–${years.at(-1)}  obs=${countObservations(ds)}` +
    `  latest=${ds.latestReferencePeriod}  vintage=${ds.source.vintage} (${ds.source.vintageLabel})`,
  );
  if (ds.aggregates.length) console.log(`    aggregates kept as reference areas (not countries): ${ds.aggregates.map(a => a.sourceCode).join(", ")}`);
  const euro = ds.countries.filter(c => c.euroAreaAdoption);
  if (euro.length) console.log(`    euro-area members using XM from adoption: ${euro.length} (${euro.map(c => `${c.iso3}@${c.euroAreaAdoption}`).join(" ")})`);
  if (issues.unmapped.length) console.log(`    unmapped source codes: ${issues.unmapped.join(", ")}`);
  if (issues.duplicatesCollapsed) console.log(`    identical duplicates collapsed: ${issues.duplicatesCollapsed}`);
  for (const e of errors.slice(0, 20)) console.log(`    [error] ${e}`);
  if (errors.length > 20) console.log(`    [error] … ${errors.length - 20} more`);
}

async function main(): Promise<void> {
  const t0 = Date.now();
  const generatedAt = new Date().toISOString();
  const weoCodes = WEO_INDICATOR_IDS.map(id => MACRO_INDICATORS[id].sourceCode);

  console.log(`[macro] IMF WEO  ${buildWeoDataUrl(weoCodes, WEO_START_YEAR)}`);
  console.log(`[macro] BIS      ${buildBisPolicyRateUrl(BIS_START_YEAR)}`);

  // Both sources must succeed; a network failure aborts before any write.
  const [weo, bis] = await Promise.all([
    fetchWeo(weoCodes, WEO_START_YEAR),
    fetchBisPolicyRates(BIS_START_YEAR),
  ]);
  console.log(`[macro] IMF ${weo.dataflow ?? "?"} published ${weo.publicationDate ?? "?"}: ${weo.series.length} series`);
  console.log(`[macro] BIS WS_CBPOL: ${bis.length} monthly rows`);

  const candidates: Candidate[] = [
    ...WEO_INDICATOR_IDS.map(id => {
      const { dataset, issues } = normalizeWeoIndicator(weo, id, { startYear: WEO_START_YEAR, generatedAt });
      return check(dataset, issues);
    }),
    (() => {
      const { dataset, issues } = normalizeBisPolicyRates(bis, { startYear: BIS_START_YEAR, generatedAt });
      return check(dataset, issues);
    })(),
  ];

  console.log("\n[macro] Summary");
  for (const c of candidates) summarize(c);

  const failed = candidates.filter(c => c.errors.length > 0);
  if (failed.length > 0) {
    console.error(`\n[macro] ${failed.length} dataset(s) failed validation — no cache file was written.`);
    process.exit(1);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  let written = 0;
  let unchanged = 0;
  for (const { dataset } of candidates) {
    const file = dataset.indicator.cacheFile;
    const existing = readExisting(file);
    if (existing && isSameDataIgnoringGeneratedAt(existing, dataset)) {
      unchanged++;
      continue;
    }
    const target = join(OUTPUT_DIR, file);
    const tmp = `${target}.tmp-${process.pid}`;
    writeFileSync(tmp, serializeMacroDataset(dataset), "utf-8");
    renameSync(tmp, target);
    written++;
  }

  console.log(`\n[macro] Done in ${((Date.now() - t0) / 1000).toFixed(1)}s — written=${written} unchanged=${unchanged}`);
}

main().catch(err => {
  console.error("[macro] Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
