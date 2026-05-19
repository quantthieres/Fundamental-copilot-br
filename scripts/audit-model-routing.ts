/**
 * Model Routing Audit — verifies that every B3 asset in the universe
 * is assigned to the correct dashboard model route.
 *
 * Usage:
 *   npm run coverage:audit:models
 *
 * Offline: uses only static cache-presence data (no network, no live API).
 */

import { B3_UNIVERSE } from "../src/data/b3-universe";
import type { B3Asset } from "../src/data/b3-universe";
import { resolveModelRoute, type ModelRoute } from "../src/lib/coverage/model-routing";
import { classifyAsset } from "../src/lib/coverage/asset-classifier";
import { hasBankAnalysisCache } from "../src/lib/banks/bank-coverage";
import { hasFiiAnalysisCache } from "../src/lib/fiis/fii-coverage";
import { hasInsuranceAnalysisCache } from "../src/lib/insurance/insurance-coverage";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RouteGroup {
  route:      ModelRoute;
  assets:     B3Asset[];
  suspicious: string[];
}

// ─── Audit logic ──────────────────────────────────────────────────────────────

const ALL_ROUTES: ModelRoute[] = [
  "industrial",
  "bank",
  "fii",
  "insurance",
  "quote_only",
  "sector_specific_pending",
  "unavailable",
];

function buildGroups(): Map<ModelRoute, RouteGroup> {
  const groups = new Map<ModelRoute, RouteGroup>(
    ALL_ROUTES.map(r => [r, { route: r, assets: [], suspicious: [] }]),
  );

  for (const asset of B3_UNIVERSE) {
    const route = resolveModelRoute(asset);
    const group = groups.get(route)!;
    group.assets.push(asset);

    const type = classifyAsset(asset.ticker, {
      b3AssetType: asset.assetType,
      sector:      asset.sector,
      companyName: asset.companyName,
    });

    // Non-industrial type routed to industrial model.
    if (
      route === "industrial" &&
      type !== "common_stock" &&
      type !== "preferred_stock" &&
      type !== "unit"
    ) {
      group.suspicious.push(
        `${asset.ticker}: richType=${type} unexpectedly in industrial route`,
      );
    }

    // Cache available but not using that model route.
    if (type === "bank" && hasBankAnalysisCache(asset.ticker) && route !== "bank") {
      group.suspicious.push(
        `${asset.ticker}: bank cache available but routed to "${route}"`,
      );
    }
    if (type === "fii" && hasFiiAnalysisCache(asset.ticker) && route !== "fii") {
      group.suspicious.push(
        `${asset.ticker}: FII cache available but routed to "${route}"`,
      );
    }
    if (type === "insurance" && hasInsuranceAnalysisCache(asset.ticker) && route !== "insurance") {
      group.suspicious.push(
        `${asset.ticker}: insurance cache available but routed to "${route}"`,
      );
    }

    // Unavailable coverageStatus in a live model route.
    if (asset.coverageStatus === "unavailable" && route !== "unavailable") {
      group.suspicious.push(
        `${asset.ticker}: coverageStatus=unavailable but routed to "${route}"`,
      );
    }

    // sector_specific_model_required in industrial route (should never happen).
    if (
      asset.coverageStatus === "sector_specific_model_required" &&
      route === "industrial"
    ) {
      group.suspicious.push(
        `${asset.ticker}: coverageStatus=sector_specific_model_required but in industrial route`,
      );
    }
  }

  return groups;
}

// ─── Formatting ───────────────────────────────────────────────────────────────

const ROUTE_LABEL: Record<ModelRoute, string> = {
  industrial:               "Industrial (CVM)",
  bank:                     "Banco",
  fii:                      "FII",
  insurance:                "Seguradora",
  quote_only:               "Cotação apenas",
  sector_specific_pending:  "Modelo específico pendente",
  unavailable:              "Indisponível / descontinuado",
};

function printGroup(group: RouteGroup): void {
  const label   = ROUTE_LABEL[group.route];
  const count   = group.assets.length;
  const sample  = group.assets.slice(0, 10).map(a => a.ticker).join("  ");
  const more    = group.assets.length > 10 ? `  … +${group.assets.length - 10}` : "";
  const susFlag = group.suspicious.length > 0 ? " ⚠" : " ✓";

  console.log(`\n  ${susFlag} ${label.padEnd(28)}  ${String(count).padStart(3)}`);
  if (count > 0) {
    console.log(`      ${sample}${more}`);
  }
  if (group.suspicious.length > 0) {
    console.log(`      Suspicious (${group.suspicious.length}):`);
    for (const msg of group.suspicious) {
      console.log(`        ⚠ ${msg}`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  Model Routing Audit — Fundamental Copilot BR");
  console.log(`  Universe: ${B3_UNIVERSE.length} assets`);
  console.log("══════════════════════════════════════════════════════════");
  console.log("  Route                          Count");
  console.log("  ─────────────────────────────────────");

  const groups = buildGroups();
  let totalSuspicious = 0;

  for (const group of groups.values()) {
    printGroup(group);
    totalSuspicious += group.suspicious.length;
  }

  console.log("\n──────────────────────────────────────────────────────────");
  if (totalSuspicious === 0) {
    console.log("  ✓ No suspicious routing cases. All routes look correct.");
  } else {
    console.log(`  ⚠ ${totalSuspicious} suspicious routing case(s) require review.`);
  }
  console.log("──────────────────────────────────────────────────────────\n");
}

main();
