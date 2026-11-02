/**
 * Cache freshness audit — offline, read-only, informational (never fails on age).
 *
 * Usage:
 *   npm run cache:audit:freshness
 *
 * For each cache family reports the number of JSON files, how many carry a
 * usable provenance timestamp, the oldest/newest timestamp and the files older
 * than a per-family threshold.
 *
 * Timestamps come only from the JSON content (generatedAt for CVM/forecast
 * caches, updatedAt for bank/FII/insurance caches). Filesystem mtime is NOT
 * used: in a git checkout it reflects the clone time, not the data.
 *
 * Note: the scheduled refresh restores files whose only change is the
 * timestamp, so a timestamp means "content last changed", not "last checked".
 * Annual DFP caches therefore legitimately age up to a year between filings.
 */

import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const DATA_ROOT = join(process.cwd(), "src/data");
const DAY_MS = 24 * 60 * 60 * 1000;

interface Family {
  name: string;
  dir: string;
  /** Timestamp fields to try, in order. */
  fields: string[];
  /** Files older than this are listed as apparently stale. */
  thresholdDays: number;
}

const FAMILIES: Family[] = [
  { name: "CVM annual financials", dir: "cvm-cache/financials",              fields: ["generatedAt"], thresholdDays: 400 },
  { name: "CVM documents",         dir: "cvm-cache/documents",               fields: ["generatedAt"], thresholdDays: 400 },
  { name: "CVM quarterly",         dir: "cvm-cache/quarterly",               fields: ["generatedAt"], thresholdDays: 200 },
  { name: "Time series",           dir: "forecast-cache/time-series",        fields: ["generatedAt"], thresholdDays: 200 },
  { name: "Baseline forecasts",    dir: "forecast-cache/baseline-forecasts", fields: ["generatedAt"], thresholdDays: 200 },
  { name: "Banks",                 dir: "bank-cache/annual",                 fields: ["updatedAt"],   thresholdDays: 400 },
  { name: "FIIs",                  dir: "fii-cache/monthly",                 fields: ["updatedAt"],   thresholdDays: 90 },
  { name: "Insurance",             dir: "insurance-cache/annual",            fields: ["updatedAt"],   thresholdDays: 400 },
];

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Returns epoch ms for a trustworthy ISO-8601 UTC timestamp, else null. */
function readTimestamp(json: unknown, fields: string[], now: number): number | null {
  if (!json || typeof json !== "object") return null;
  for (const field of fields) {
    const v = (json as Record<string, unknown>)[field];
    if (typeof v !== "string" || !ISO_TIMESTAMP.test(v)) continue;
    const t = Date.parse(v);
    // Reject unparseable values and timestamps in the future (clock/merge errors).
    if (!Number.isNaN(t) && t <= now + DAY_MS) return t;
  }
  return null;
}

interface FamilyReport {
  family: Family;
  files: number;
  withTimestamp: number;
  withoutTimestamp: string[];
  oldest: number | null;
  newest: number | null;
  stale: { ticker: string; ageDays: number }[];
  placeholders: number;
}

function auditFamily(family: Family, now: number): FamilyReport {
  const dir = join(DATA_ROOT, family.dir);
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter(f => f.endsWith(".json")).sort();
  } catch {
    // Missing directory → reported as 0 files.
  }

  const report: FamilyReport = {
    family, files: files.length, withTimestamp: 0, withoutTimestamp: [],
    oldest: null, newest: null, stale: [], placeholders: 0,
  };

  for (const file of files) {
    const ticker = file.replace(/\.json$/, "");
    let json: unknown = null;
    try {
      json = JSON.parse(readFileSync(join(dir, file), "utf-8"));
    } catch {
      // Unparseable → no usable timestamp.
    }
    if (json && typeof json === "object" && (json as Record<string, unknown>).available === false) {
      report.placeholders++;
    }
    const t = readTimestamp(json, family.fields, now);
    if (t === null) {
      report.withoutTimestamp.push(ticker);
      continue;
    }
    report.withTimestamp++;
    if (report.oldest === null || t < report.oldest) report.oldest = t;
    if (report.newest === null || t > report.newest) report.newest = t;
    const ageDays = Math.floor((now - t) / DAY_MS);
    if (ageDays > family.thresholdDays) report.stale.push({ ticker, ageDays });
  }

  report.stale.sort((a, b) => b.ageDays - a.ageDays);
  return report;
}

function fmt(t: number | null): string {
  return t === null ? "—" : new Date(t).toISOString().slice(0, 10);
}

function main(): void {
  const now = Date.now();
  console.log("\nCache freshness audit (informational — does not fail on age)");
  console.log(`Reference date: ${new Date(now).toISOString().slice(0, 10)}\n`);

  const reports = FAMILIES.map(f => auditFamily(f, now));

  for (const r of reports) {
    const { family } = r;
    console.log(`── ${family.name}  (src/data/${family.dir}, field: ${family.fields.join("|")})`);
    console.log(`   JSON files:          ${r.files}${r.placeholders > 0 ? ` (${r.placeholders} placeholder available:false)` : ""}`);
    if (r.files > 0 && r.withTimestamp === 0) {
      console.log("   freshness metadata unavailable");
    } else {
      console.log(`   with timestamp:      ${r.withTimestamp}`);
      console.log(`   without timestamp:   ${r.withoutTimestamp.length}${r.withoutTimestamp.length > 0 ? ` (${r.withoutTimestamp.join(", ")})` : ""}`);
      console.log(`   oldest / newest:     ${fmt(r.oldest)} / ${fmt(r.newest)}`);
      const staleList = r.stale.slice(0, 15).map(s => `${s.ticker} ${s.ageDays}d`).join(", ");
      console.log(
        `   older than ${family.thresholdDays}d:     ${r.stale.length}` +
          (r.stale.length > 0 ? ` (${staleList}${r.stale.length > 15 ? ", …" : ""})` : ""),
      );
    }
    console.log("");
  }

  const totalFiles = reports.reduce((n, r) => n + r.files, 0);
  const totalStale = reports.reduce((n, r) => n + r.stale.length, 0);
  const totalMissing = reports.reduce((n, r) => n + r.withoutTimestamp.length, 0);
  console.log("─────────────────────────────────────────");
  console.log(`  Files: ${totalFiles} · without timestamp: ${totalMissing} · older than threshold: ${totalStale}`);
  console.log("─────────────────────────────────────────\n");
}

main();
