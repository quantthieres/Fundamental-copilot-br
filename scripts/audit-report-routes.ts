/**
 * Report Routes Audit — verifies that every B3 asset would produce a valid
 * report page rather than an error/unavailable state.
 *
 * Usage:
 *   npm run report:audit
 *
 * Offline: uses only static cache-presence data (no network, no HTTP).
 *
 * Exit code 0 = no unexpected failures.
 * Exit code 1 = at least one unexpected report failure.
 */

import { existsSync } from "fs";
import { join } from "path";
import { B3_UNIVERSE } from "../src/data/b3-universe";
import type { B3Asset } from "../src/data/b3-universe";
import { resolveModelRoute, type ModelRoute } from "../src/lib/coverage/model-routing";
import { hasBankAnalysisCache } from "../src/lib/banks/bank-coverage";
import { hasFiiAnalysisCache } from "../src/lib/fiis/fii-coverage";
import { hasInsuranceAnalysisCache } from "../src/lib/insurance/insurance-coverage";
import { parseFinancialsCache } from "../src/lib/cvm/precomputed-cache";
import { readFileSync } from "fs";

// ─── Cache helpers ────────────────────────────────────────────────────────────

const FINANCIALS_DIR = join(process.cwd(), "src/data/cvm-cache/financials");

function readFinancialsCache(ticker: string): string | null {
  const p = join(FINANCIALS_DIR, `${ticker.toUpperCase()}.json`);
  try { return readFileSync(p, "utf-8"); } catch { return null; }
}

function hasFinancialsCache(ticker: string): boolean {
  return existsSync(join(FINANCIALS_DIR, `${ticker.toUpperCase()}.json`));
}

function getFinancialsYearCount(ticker: string): number {
  const raw = readFinancialsCache(ticker);
  if (!raw) return 0;
  const parsed = parseFinancialsCache(raw);
  return parsed?.length ?? 0;
}

// ─── Result types ─────────────────────────────────────────────────────────────

type ReportStatus =
  | "ok_industrial_full"        // ≥2 years CVM data
  | "ok_industrial_limited"     // 1 year CVM data (growth indicators absent, but page renders)
  | "ok_industrial_legacy"      // no CVM cache, falls to ReportPageClient (mock data)
  | "ok_bank"
  | "ok_fii"
  | "ok_insurance"
  | "ok_informational"
  | "ok_unavailable"
  | "ok_fallback"               // quote_only / sector_specific_pending — fallback page
  | "fail_industrial_no_cache"  // industrial route, no CVM cache AND not in mock registry
  | "fail_bank_no_cache"
  | "fail_fii_no_cache"
  | "fail_insurance_no_cache";

const MOCK_REGISTRY = new Set(["WEGE3", "EGIE3", "CPFE3", "ABEV3", "VIVT3"]);

interface AuditEntry {
  ticker:  string;
  route:   ModelRoute;
  status:  ReportStatus;
  detail?: string;
}

// ─── Audit logic ──────────────────────────────────────────────────────────────

function auditAsset(asset: B3Asset): AuditEntry {
  const route = resolveModelRoute(asset);
  const t = asset.ticker;

  switch (route) {
    case "industrial": {
      if (hasFinancialsCache(t)) {
        const years = getFinancialsYearCount(t);
        return {
          ticker: t, route,
          status: years >= 2 ? "ok_industrial_full" : "ok_industrial_limited",
          detail: `${years} year(s) in cache`,
        };
      }
      if (MOCK_REGISTRY.has(t)) {
        return { ticker: t, route, status: "ok_industrial_legacy", detail: "mock registry" };
      }
      return {
        ticker: t, route,
        status: "fail_industrial_no_cache",
        detail: "no CVM cache and not in mock registry — report would show 'Ticker não encontrado'",
      };
    }

    case "bank":
      return {
        ticker: t, route,
        status: hasBankAnalysisCache(t) ? "ok_bank" : "fail_bank_no_cache",
        detail: hasBankAnalysisCache(t) ? undefined : "no bank cache",
      };

    case "fii":
      return {
        ticker: t, route,
        status: hasFiiAnalysisCache(t) ? "ok_fii" : "fail_fii_no_cache",
        detail: hasFiiAnalysisCache(t) ? undefined : "no FII cache",
      };

    case "insurance":
      return {
        ticker: t, route,
        status: hasInsuranceAnalysisCache(t) ? "ok_insurance" : "fail_insurance_no_cache",
        detail: hasInsuranceAnalysisCache(t) ? undefined : "no insurance cache",
      };

    case "informational_instrument":
      return { ticker: t, route, status: "ok_informational" };

    case "unavailable":
      return { ticker: t, route, status: "ok_unavailable" };

    case "quote_only":
    case "sector_specific_pending":
      return { ticker: t, route, status: "ok_fallback" };

    default:
      return { ticker: t, route, status: "ok_fallback" };
  }
}

// ─── Formatting ───────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ReportStatus, string> = {
  ok_industrial_full:       "✓ Industrial — dados completos (≥2 anos)",
  ok_industrial_limited:    "⚠ Industrial — dados limitados (1 ano)",
  ok_industrial_legacy:     "~ Industrial — fallback mock",
  ok_bank:                  "✓ Banco",
  ok_fii:                   "✓ FII",
  ok_insurance:             "✓ Seguradora",
  ok_informational:         "✓ Informativo (ETF/BDR)",
  ok_unavailable:           "✓ Indisponível/descontinuado",
  ok_fallback:              "✓ Fallback (cotação apenas)",
  fail_industrial_no_cache: "✗ FALHA — Industrial sem cache CVM",
  fail_bank_no_cache:       "✗ FALHA — Banco sem cache",
  fail_fii_no_cache:        "✗ FALHA — FII sem cache",
  fail_insurance_no_cache:  "✗ FALHA — Seguradora sem cache",
};

const FAIL_STATUSES = new Set<ReportStatus>([
  "fail_industrial_no_cache",
  "fail_bank_no_cache",
  "fail_fii_no_cache",
  "fail_insurance_no_cache",
]);

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const results = B3_UNIVERSE.map(auditAsset);

  // Group by status
  const grouped = new Map<ReportStatus, AuditEntry[]>();
  for (const r of results) {
    if (!grouped.has(r.status)) grouped.set(r.status, []);
    grouped.get(r.status)!.push(r);
  }

  const failures = results.filter(r => FAIL_STATUSES.has(r.status));
  const warnings = results.filter(r => r.status === "ok_industrial_limited");

  console.log("\n══════════════════════════════════════════════════════════════════");
  console.log("  Report Routes Audit — Fundamental Copilot BR");
  console.log(`  Universe: ${B3_UNIVERSE.length} assets`);
  console.log("══════════════════════════════════════════════════════════════════");

  const ORDER: ReportStatus[] = [
    "ok_industrial_full",
    "ok_industrial_limited",
    "ok_industrial_legacy",
    "ok_bank",
    "ok_fii",
    "ok_insurance",
    "ok_informational",
    "ok_unavailable",
    "ok_fallback",
    "fail_industrial_no_cache",
    "fail_bank_no_cache",
    "fail_fii_no_cache",
    "fail_insurance_no_cache",
  ];

  for (const status of ORDER) {
    const group = grouped.get(status);
    if (!group || group.length === 0) continue;
    const label = STATUS_LABEL[status];
    const tickers = group.map(e => e.ticker).join("  ");
    console.log(`\n  ${label.padEnd(44)} (${group.length})`);
    console.log(`    ${tickers}`);
    if (FAIL_STATUSES.has(status)) {
      for (const entry of group) {
        if (entry.detail) console.log(`    → ${entry.ticker}: ${entry.detail}`);
      }
    }
  }

  console.log("\n──────────────────────────────────────────────────────────────────");

  if (warnings.length > 0) {
    console.log(`  ⚠ ${warnings.length} ticker(s) have only 1 year of CVM data (limited indicators):`);
    console.log(`    ${warnings.map(e => e.ticker).join("  ")}`);
  }

  if (failures.length === 0) {
    console.log("  ✓ No unexpected report failures. All routes produce valid pages.");
    console.log("──────────────────────────────────────────────────────────────────\n");
    process.exit(0);
  } else {
    console.log(`\n  ✗ ${failures.length} unexpected report failure(s):`);
    for (const f of failures) {
      console.log(`    ${f.ticker} [${f.route}]: ${f.detail ?? "no detail"}`);
    }
    console.log("──────────────────────────────────────────────────────────────────\n");
    process.exit(1);
  }
}

main();
