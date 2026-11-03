/**
 * Asset Readiness Audit — answers "is every asset actually covered at the
 * intended product level?" (product completeness).
 *
 * Complements, and does not replace:
 *   coverage:audit:models  → routing correctness
 *   report:audit           → rendering safety (a fallback page renders, but a
 *                            fallback is NOT coverage)
 *
 * Usage:
 *   npm run coverage:audit:readiness               # print the audit
 *   npm run coverage:audit:readiness -- --write-doc
 *       also regenerates the GENERATED section of docs/asset-readiness-audit.md
 *       (hand-maintained research notes outside the markers are preserved)
 *
 * Offline: reads B3_UNIVERSE, lifecycle/alias/decision tables and local cache
 * files only. Exits 1 on integrity errors (stale statuses, broken successor
 * or alias links), not on pending work.
 */
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { B3_UNIVERSE } from "../src/data/b3-universe";
import { assessAssetReadiness, buildReadinessInput } from "../src/lib/coverage/asset-readiness-inputs";
import {
  MODEL_PROJECT_LABEL,
  READINESS_ORDER,
  groupModelProjects,
  type AssetReadiness,
  type ReadinessResult,
} from "../src/lib/coverage/asset-readiness";
import { CURATION_EXCLUSIONS, TICKER_LIFECYCLE } from "../src/lib/coverage/ticker-lifecycle";
import { FUNDAMENTALS_ALIASES } from "../src/lib/coverage/fundamentals-alias";
import { getIssuerKey } from "../src/lib/coverage/issuer-identity";

const DOC_PATH = join(process.cwd(), "docs/asset-readiness-audit.md");
const BEGIN = "<!-- BEGIN GENERATED: npm run coverage:audit:readiness -- --write-doc -->";
const END = "<!-- END GENERATED -->";

const LABEL: Record<AssetReadiness, string> = {
  analysis_ready: "Analysis ready",
  analysis_limited: "Analysis limited",
  informational_ready: "Informational ready",
  intentionally_limited: "Intentionally limited",
  manual_review: "Manual review",
  model_pending: "Model pending",
  cache_pending: "Cache pending (model exists)",
  historical_or_unavailable: "Historical/unavailable",
  current_ticker_missing: "Current successor missing (curated)",
};

const universeTickers = new Set(B3_UNIVERSE.map(a => a.ticker));
const byTicker = new Map(B3_UNIVERSE.map(a => [a.ticker, a]));

function issuerOf(ticker: string): { key: string; name: string } {
  return { key: getIssuerKey(ticker), name: byTicker.get(ticker)?.companyName ?? ticker };
}

// ─── Integrity checks (exit 1) ────────────────────────────────────────────────

function integrityErrors(): string[] {
  const errors: string[] = [];
  for (const lc of Object.values(TICKER_LIFECYCLE)) {
    const asset = byTicker.get(lc.ticker);
    if (!asset) { errors.push(`lifecycle entry ${lc.ticker} is not in B3_UNIVERSE`); continue; }
    if (asset.coverageStatus !== "unavailable") {
      errors.push(`${lc.ticker} is ${lc.status} but coverageStatus is still "${asset.coverageStatus}"`);
    }
    if (lc.successorTicker && TICKER_LIFECYCLE[lc.successorTicker]) {
      errors.push(`${lc.ticker} → ${lc.successorTicker}: successor is itself historical`);
    }
  }
  for (const ex of CURATION_EXCLUSIONS) {
    if (universeTickers.has(ex.ticker)) errors.push(`${ex.ticker} is listed as a curation exclusion but is in B3_UNIVERSE`);
    if (!universeTickers.has(ex.issuerTicker)) errors.push(`curation exclusion ${ex.ticker}: issuer ticker ${ex.issuerTicker} not in B3_UNIVERSE`);
  }
  for (const a of B3_UNIVERSE) {
    if (a.coverageStatus === "unavailable" && !TICKER_LIFECYCLE[a.ticker]) {
      errors.push(`${a.ticker} is unavailable without lifecycle metadata`);
    }
  }
  for (const alias of Object.values(FUNDAMENTALS_ALIASES)) {
    if (!universeTickers.has(alias.ticker)) errors.push(`alias ${alias.ticker} is not in B3_UNIVERSE`);
    if (FUNDAMENTALS_ALIASES[alias.fundamentalsTicker]) errors.push(`alias chain ${alias.ticker} → ${alias.fundamentalsTicker}`);
    if (TICKER_LIFECYCLE[alias.ticker]) errors.push(`historical ticker ${alias.ticker} must not be an alias source`);
  }
  return errors;
}

// ─── Static status consistency (documented, not fatal) ───────────────────────

function staticStatusNotes(): string[] {
  const notes: string[] = [];
  for (const a of B3_UNIVERSE) {
    const input = buildReadinessInput(a);
    if (input.lifecycle) continue;
    const industrialDeclared = a.coverageStatus === "full_analysis" || a.coverageStatus === "cvm_analysis" || a.coverageStatus === "cvm_financials";
    if (industrialDeclared && input.annualYears === null) {
      notes.push(`${a.ticker}: declared ${a.coverageStatus} but no annual CVM cache`);
    } else if ((a.coverageStatus === "full_analysis" || a.coverageStatus === "cvm_analysis") && (input.annualYears ?? 0) <= 1) {
      notes.push(`${a.ticker}: declared ${a.coverageStatus} but the annual CVM cache has ${input.annualYears} fiscal year(s) — readiness reports analysis_limited`);
    }
    if (a.coverageStatus === "quote_only" && input.annualYears !== null) {
      notes.push(`${a.ticker}: declared quote_only but an annual CVM cache exists (${input.annualYears} years)`);
    }
  }
  return notes;
}

// ─── Report ───────────────────────────────────────────────────────────────────

function render(results: ReadinessResult[]): string {
  const lines: string[] = [];
  const out = (s = "") => lines.push(s);
  const groups = new Map<AssetReadiness, ReadinessResult[]>(READINESS_ORDER.map(r => [r, []]));
  for (const r of results) groups.get(r.readiness)!.push(r);

  out(`Total assets: ${results.length} (curated universe — see curation exclusions below)`);
  out();
  for (const r of READINESS_ORDER) out(`${LABEL[r].padEnd(37)} ${groups.get(r)!.length}`);
  const sum = READINESS_ORDER.reduce((n, r) => n + groups.get(r)!.length, 0);
  out(`${"Sum of buckets".padEnd(37)} ${sum}${sum === results.length ? " (= total)" : " (MISMATCH)"}`);

  const issuersWithReady = new Set(groups.get("analysis_ready")!.map(r => getIssuerKey(r.ticker)));
  out();
  out(`Distinct issuers analysis-ready: ${issuersWithReady.size}`);

  out();
  out("## MODEL DEVELOPMENT PROJECTS (grouped by issuer)");
  const projects = groupModelProjects(results, issuerOf);
  for (const [project, byIssuer] of [...projects.entries()].sort()) {
    const pending = [...byIssuer.values()].filter(e => !e.reviewOnly);
    const review = [...byIssuer.values()].filter(e => e.reviewOnly);
    out(`- ${MODEL_PROJECT_LABEL[project]}: ${pending.length} issuer(s) pending` +
        (review.length ? `, ${review.length} industrial review candidate(s)` : ""));
    for (const e of pending) out(`    pending  ${e.name} — ${e.tickers.join(", ")}`);
    for (const e of review) out(`    review   ${e.name} — ${e.tickers.join(", ")} (currently industrial)`);
  }

  out();
  out("## CURRENT-TICKER MAINTENANCE (historical code → current code)");
  for (const r of groups.get("current_ticker_missing")!) out(`- MISSING ${r.ticker} → ${r.successorTicker}: ${r.reason}`);
  for (const lc of Object.values(TICKER_LIFECYCLE).sort((a, b) => a.ticker.localeCompare(b.ticker))) {
    const via = lc.intermediateTickers?.length ? ` via ${lc.intermediateTickers.join(" → ")}` : "";
    const target = lc.successorTicker ? `→ ${lc.successorTicker}${universeTickers.has(lc.successorTicker) ? "" : " (NOT in universe)"}${via}` : "(no B3 successor)";
    const ratio = lc.conversionRatio ? `  [${lc.conversionRatio}]` : "";
    const flag = lc.verification === "needs_manual_verification" ? "  [needs_manual_verification]" : "";
    out(`- ${lc.ticker.padEnd(8)} ${lc.status.padEnd(13)} ${target}${lc.effectiveDate ? `  (${lc.effectiveDate})` : ""}${ratio}${flag}`);
  }

  out();
  out("## CURATION EXCLUSIONS (current B3 codes intentionally outside the curated universe)");
  for (const ex of CURATION_EXCLUSIONS) out(`- ${ex.ticker} (issuer tracked as ${ex.issuerTicker}): ${ex.reason}`);

  out();
  out("## FUNDAMENTALS ALIASES (quote stays ticker-specific)");
  for (const a of Object.values(FUNDAMENTALS_ALIASES).sort((x, y) => x.ticker.localeCompare(y.ticker))) {
    out(`- ${a.ticker} → ${a.fundamentalsTicker} (${a.reason})`);
  }

  const detail = (r: ReadinessResult) => {
    const asset = byTicker.get(r.ticker)!;
    const input = buildReadinessInput(asset);
    const extras = [
      `route=${input.route}`,
      r.fundamentalsTicker ? `fundamentals=${r.fundamentalsTicker}` : null,
      r.successorTicker ? `successor=${r.successorTicker}` : null,
    ].filter(Boolean).join(" ");
    return `- ${r.ticker} — ${asset.companyName} — ${input.lifecycle ? input.lifecycle.status : "active"} — ${extras}\n` +
           `    reason: ${r.reason}${r.nextAction ? `\n    next:   ${r.nextAction}` : ""}`;
  };
  for (const bucket of ["manual_review", "intentionally_limited", "model_pending", "cache_pending", "analysis_limited"] as const) {
    out();
    out(`## ${LABEL[bucket].toUpperCase()}`);
    const items = groups.get(bucket)!;
    if (items.length === 0) out("- none");
    for (const r of items) out(detail(r));
  }

  out();
  out("## INDUSTRIAL MODEL REVIEW CANDIDATES (flagged, not reclassified)");
  for (const r of results.filter(x => x.reviewFlag)) {
    out(`- ${r.ticker} — ${MODEL_PROJECT_LABEL[r.reviewFlag!.modelProject]}: ${r.reviewFlag!.reason}`);
  }

  out();
  out("## STATIC coverageStatus CONSISTENCY");
  out("(coverageStatus is authoritative only for 'unavailable' and for industrial vs quote_only route selection;");
  out(" for banks/FIIs/insurers/ETFs/BDRs the route comes from the model-cache registries and the status is metadata)");
  const notes = staticStatusNotes();
  if (notes.length === 0) out("- no conflicts between declared industrial statuses and cache presence");
  for (const n of notes) out(`- ${n}`);

  out();
  out("## READY / INFORMATIONAL / HISTORICAL (tickers)");
  for (const bucket of ["analysis_ready", "informational_ready", "historical_or_unavailable"] as const) {
    const items = groups.get(bucket)!.map(r =>
      r.fundamentalsTicker ? `${r.ticker}→${r.fundamentalsTicker}` : r.successorTicker ? `${r.ticker}⇒${r.successorTicker}` : r.ticker);
    out(`- ${LABEL[bucket]} (${items.length}): ${items.join(" ")}`);
  }
  return lines.join("\n");
}

function writeDoc(body: string): void {
  const generated = `${BEGIN}\n\n\`\`\`text\n${body}\n\`\`\`\n\n${END}`;
  let doc = existsSync(DOC_PATH) ? readFileSync(DOC_PATH, "utf-8") : `# Asset readiness audit\n\n${BEGIN}\n${END}\n`;
  const start = doc.indexOf(BEGIN);
  const end = doc.indexOf(END);
  if (start < 0 || end < start) throw new Error(`${DOC_PATH}: generated-section markers not found`);
  doc = doc.slice(0, start) + generated + doc.slice(end + END.length);
  writeFileSync(DOC_PATH, doc, "utf-8");
}

function main(): void {
  const results = B3_UNIVERSE.map(assessAssetReadiness);
  const body = render(results);

  console.log("\n══════════════════════════════════════════════════════════════════");
  console.log("  Asset Readiness Audit — Fundamental Copilot BR");
  console.log("  (product coverage — a renderable fallback is NOT coverage)");
  console.log("══════════════════════════════════════════════════════════════════\n");
  console.log(body);

  const errors = integrityErrors();
  if (results.length !== B3_UNIVERSE.length) errors.push("readiness results do not cover the universe");
  console.log("\n──────────────────────────────────────────────────────────────────");
  if (errors.length > 0) {
    console.log(`  ✗ ${errors.length} integrity error(s):`);
    for (const e of errors) console.log(`    ${e}`);
  } else {
    console.log("  ✓ Lifecycle, successor and alias metadata are consistent.");
  }
  console.log("──────────────────────────────────────────────────────────────────\n");

  if (process.argv.includes("--write-doc")) {
    writeDoc(body);
    console.log(`  Updated generated section of ${DOC_PATH}`);
  }
  if (errors.length > 0) process.exit(1);
}

main();
