/**
 * Quote-Only Coverage Audit — inspects every B3 asset that lacks a full
 * model and classifies it with a suggested action.
 *
 * Usage:
 *   npm run coverage:audit:quote-only
 *
 * Offline: no network, no live API. Reads only static cache files.
 *
 * Groups inspected:
 *   - quote_only tickers
 *   - sector_specific_model_required without an implemented model cache
 *   - informational_instrument (ETF/BDR) — already handled, shown for completeness
 *   - unavailable/discontinued
 *
 * Generates docs/coverage-audit-quote-only.md when --md flag is present,
 * or always when run from npm run coverage:audit:quote-only.
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { B3_UNIVERSE } from "../src/data/b3-universe";
import type { B3Asset } from "../src/data/b3-universe";
import { resolveModelRoute, type ModelRoute } from "../src/lib/coverage/model-routing";
import { classifyAsset } from "../src/lib/coverage/asset-classifier";
import { hasBankAnalysisCache } from "../src/lib/banks/bank-coverage";
import { hasFiiAnalysisCache } from "../src/lib/fiis/fii-coverage";
import { hasInsuranceAnalysisCache } from "../src/lib/insurance/insurance-coverage";
import { getCvmCompanyByTicker } from "../src/lib/cvm/company-map";
import { parseFinancialsCache } from "../src/lib/cvm/precomputed-cache";

// ─── Cache helpers ────────────────────────────────────────────────────────────

const FINANCIALS_DIR  = join(process.cwd(), "src/data/cvm-cache/financials");
const FII_CACHE_DIR   = join(process.cwd(), "src/data/fii-cache/monthly");
const BANK_CACHE_DIR  = join(process.cwd(), "src/data/bank-cache/annual");
const INS_CACHE_DIR   = join(process.cwd(), "src/data/insurance-cache/annual");

function hasCvmFinancialsFile(ticker: string): boolean {
  return existsSync(join(FINANCIALS_DIR, `${ticker}.json`));
}

function cvmFinancialsYears(ticker: string): number {
  const p = join(FINANCIALS_DIR, `${ticker}.json`);
  try {
    const raw = readFileSync(p, "utf-8");
    return parseFinancialsCache(raw)?.length ?? 0;
  } catch { return 0; }
}

// Sector model cache files may be intentional placeholders written with
// `available: false` (e.g. SULA11 incorporated, BCFF11 without CNPJ). Only
// files that are not explicitly unavailable count as implemented model caches.
type ModelCacheState = "missing" | "implemented" | "placeholder";

function modelCacheState(dir: string, ticker: string): ModelCacheState {
  const p = join(dir, `${ticker}.json`);
  if (!existsSync(p)) return "missing";
  try {
    const parsed = JSON.parse(readFileSync(p, "utf-8")) as { available?: unknown };
    return parsed.available === false ? "placeholder" : "implemented";
  } catch { return "implemented"; }
}

function hasFiiCacheFile(ticker: string): boolean {
  return modelCacheState(FII_CACHE_DIR, ticker) === "implemented";
}

function hasBankCacheFile(ticker: string): boolean {
  return modelCacheState(BANK_CACHE_DIR, ticker) === "implemented";
}

function hasInsuranceCacheFile(ticker: string): boolean {
  return modelCacheState(INS_CACHE_DIR, ticker) === "implemented";
}

function hasPlaceholderModelCache(ticker: string): boolean {
  return [FII_CACHE_DIR, BANK_CACHE_DIR, INS_CACHE_DIR]
    .some(dir => modelCacheState(dir, ticker) === "placeholder");
}

// ─── Known metadata ───────────────────────────────────────────────────────────

// Tickers whose CVM entity was CANCELADA at time of last registry audit.
// Source: comments in src/lib/cvm/company-map.ts.
const KNOWN_CANCELLED = new Set(["GOLL4", "CRFB3", "SOMA3", "BRPR3"]);

// Obsolete ticker codes: the trading code itself is no longer listed in the
// CVM FCA valor_mobiliario file (renamed or replaced). Verified 2026-11-02.
//   RRRP3 → BRAV3 (3R Petroleum renamed Brava Energia, same CNPJ)
//   VVAR3 → VIIA3 → BHIA3 (Grupo Casas Bahia, same CNPJ)
//   PETZ3 → AUAU3 (Petz/Cobasi combination; Pet Center CVM 25089 CANCELADA)
const KNOWN_OBSOLETE_TICKERS = new Set(["RRRP3", "VVAR3", "PETZ3"]);

// Tickers that are pure financial holdings without a matching industrial model.
// They hold stakes in other companies rather than operating directly.
const FINANCIAL_HOLDING = new Set(["BRAP4"]);

// Explicit review decisions for quote-only operating companies that were
// checked during mapping rounds and deliberately NOT mapped. Verified
// 2026-11-02 against cad_cia_aberta, FCA valor_mobiliario and IPE filings.
const REVIEW_DECISIONS: Record<string, { action: SuggestedAction; note: string }> = {
  VAMO3: {
    action: "manual_review",
    note: "Reorganização estratégica consumada em 2024-11-30 (concessionárias segregadas → AMOB3); compra de frota no FCO distorce FCF industrial",
  },
  SEQL3: {
    action: "manual_review",
    note: "Recuperação extrajudicial homologada 2024-10, grupamentos de ações, mudança de controle 2026-02 e repactuação de dívida 2026",
  },
  ALOS3: {
    action: "needs_sector_specific_model",
    note: "Shopping centers: exige modelo imobiliário (NOI/FFO/NAV); DFP extraído tem dívida total = 0 em todos os anos e EBIT 2023 > receita (ganho de combinação)",
  },
  AMBP3: {
    action: "keep_quote_only",
    note: "Em recuperação judicial desde 2025-10-30",
  },
  CASH3: {
    action: "keep_quote_only",
    note: "Modelo de negócio pivotado para tesouraria em Bitcoin (2025–2026) — modelo industrial inadequado",
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type SuggestedAction =
  | "candidate_for_cvm_mapping"
  | "keep_quote_only"
  | "needs_sector_specific_model"
  | "manual_review"
  | "mark_unavailable_or_discontinued"
  | "already_has_cache_but_status_mismatch";

interface AuditEntry {
  ticker:           string;
  companyName:      string;
  assetType:        string;
  sector:           string;
  subsector:        string;
  coverageStatus:   string;
  modelRoute:       ModelRoute;
  hasCvmMapping:    boolean;
  hasCvmCache:      boolean;
  cvmCacheYears:    number;
  hasModelCache:    boolean; // bank/FII/insurance cache
  richType:         string;
  suggestedAction:  SuggestedAction;
  notes:            string;
}

// ─── Classification ───────────────────────────────────────────────────────────

function getRichType(asset: B3Asset): string {
  return classifyAsset(asset.ticker, {
    b3AssetType: asset.assetType,
    sector:      asset.sector,
    companyName: asset.companyName,
  });
}

function getModelCache(asset: B3Asset): boolean {
  return (
    hasBankAnalysisCache(asset.ticker) ||
    hasFiiAnalysisCache(asset.ticker)  ||
    hasInsuranceAnalysisCache(asset.ticker)
  );
}

function getModelCacheFile(asset: B3Asset): boolean {
  return (
    hasBankCacheFile(asset.ticker)     ||
    hasFiiCacheFile(asset.ticker)      ||
    hasInsuranceCacheFile(asset.ticker)
  );
}

function suggestAction(asset: B3Asset, hasCvmCache: boolean, hasCvmMapping: boolean): SuggestedAction {
  // A cache file already exists for this ticker despite being QO/SS.
  if (hasCvmCache) return "already_has_cache_but_status_mismatch";

  // Declared unavailable in B3_UNIVERSE is authoritative (mirrors the coverage resolver).
  if (asset.coverageStatus === "unavailable") return "mark_unavailable_or_discontinued";

  // Known discontinued/cancelled in CVM registry, or obsolete ticker code.
  if (KNOWN_CANCELLED.has(asset.ticker)) return "mark_unavailable_or_discontinued";
  if (KNOWN_OBSOLETE_TICKERS.has(asset.ticker)) return "mark_unavailable_or_discontinued";

  // Pure financial holding — no operating industrial model makes sense.
  if (FINANCIAL_HOLDING.has(asset.ticker)) return "keep_quote_only";

  // Explicit decision from a mapping-round review.
  const decision = REVIEW_DECISIONS[asset.ticker];
  if (decision) return decision.action;

  const richType = getRichType(asset);

  // Asset type implies a sector-specific model that hasn't been implemented yet.
  if (richType === "bank"     ) return "needs_sector_specific_model";
  if (richType === "fii"      ) return "needs_sector_specific_model";
  if (richType === "insurance") return "needs_sector_specific_model";
  if (richType === "etf"      ) return "needs_sector_specific_model";
  if (richType === "bdr"      ) return "needs_sector_specific_model";

  // Sector flags a non-industrial structure.
  const fin = ["Financeiro", "Holding Financeira", "Bancário"];
  if (fin.some(s => asset.sector.startsWith(s))) return "keep_quote_only";

  // CVM mapping entry exists — precomputing the cache should unblock this.
  if (hasCvmMapping) return "candidate_for_cvm_mapping";

  // Default: operating company, likely CVM-mappable with registry lookup.
  return "candidate_for_cvm_mapping";
}

function buildNotes(asset: B3Asset, entry: Omit<AuditEntry, "notes">): string {
  const notes: string[] = [];

  if (KNOWN_CANCELLED.has(asset.ticker)) {
    notes.push(asset.coverageStatus === "unavailable"
      ? "CVM entity CANCELADA per registry audit — already marked unavailable"
      : "CVM entity CANCELADA per registry audit — consider marking unavailable");
  }
  if (KNOWN_OBSOLETE_TICKERS.has(asset.ticker)) {
    notes.push(asset.coverageStatus === "unavailable"
      ? "Obsolete ticker code (renamed/replaced) — already marked unavailable"
      : "Obsolete ticker code (renamed/replaced) — consider marking unavailable");
  }
  if (entry.hasCvmCache) {
    notes.push(`CVM financials cache exists (${entry.cvmCacheYears} year(s)) but coverageStatus is still "${asset.coverageStatus}"`);
  }
  if (entry.hasModelCache && !getModelCache(asset)) {
    notes.push("Has implemented sector-specific cache file (bank/FII/insurance) but not registered in coverage set");
  }
  if (hasPlaceholderModelCache(asset.ticker)) {
    notes.push("Sector cache file is an available:false placeholder — not model coverage");
  }
  if (FINANCIAL_HOLDING.has(asset.ticker)) {
    notes.push("Pure holding company — industrial DFP model may not reflect underlying value");
  }
  const decision = REVIEW_DECISIONS[asset.ticker];
  if (decision && asset.coverageStatus === "quote_only") {
    notes.push(`Revisado: ${decision.note}`);
  }

  return notes.join("; ") || "—";
}

function auditAsset(asset: B3Asset): AuditEntry {
  const route         = resolveModelRoute(asset);
  const cvmEntry      = getCvmCompanyByTicker(asset.ticker);
  const hasCvmMapping = cvmEntry?.hasCvmMapping ?? false;
  const hasCvmCache   = hasCvmFinancialsFile(asset.ticker);
  const cvmYears      = hasCvmCache ? cvmFinancialsYears(asset.ticker) : 0;
  const hasModelCache = getModelCacheFile(asset);
  const richType      = getRichType(asset);
  const action        = suggestAction(asset, hasCvmCache, hasCvmMapping);

  const partial: Omit<AuditEntry, "notes"> = {
    ticker:          asset.ticker,
    companyName:     asset.companyName,
    assetType:       asset.assetType,
    sector:          asset.sector,
    subsector:       asset.subsector,
    coverageStatus:  asset.coverageStatus,
    modelRoute:      route,
    hasCvmMapping,
    hasCvmCache,
    cvmCacheYears:   cvmYears,
    hasModelCache,
    richType,
    suggestedAction: action,
  };

  return { ...partial, notes: buildNotes(asset, partial) };
}

// ─── Suspicious case detection ────────────────────────────────────────────────

interface SuspiciousCase {
  ticker:  string;
  reason:  string;
}

function detectSuspicious(entries: AuditEntry[]): SuspiciousCase[] {
  const cases: SuspiciousCase[] = [];

  for (const e of entries) {
    if (e.suggestedAction === "already_has_cache_but_status_mismatch") {
      cases.push({ ticker: e.ticker, reason: `CVM cache (${e.cvmCacheYears}y) exists but coverageStatus="${e.coverageStatus}"` });
    }
    if (e.suggestedAction === "mark_unavailable_or_discontinued" && e.coverageStatus !== "unavailable") {
      cases.push({ ticker: e.ticker, reason: `Known CANCELADA CVM entity still listed as "${e.coverageStatus}"` });
    }
    if (hasFiiCacheFile(e.ticker) && !hasFiiAnalysisCache(e.ticker)) {
      cases.push({ ticker: e.ticker, reason: "FII cache file on disk not registered in fii-coverage.ts CACHED_TICKERS set" });
    }
    if (hasBankCacheFile(e.ticker) && !hasBankAnalysisCache(e.ticker)) {
      cases.push({ ticker: e.ticker, reason: "Bank cache file on disk not registered in bank-coverage.ts" });
    }
    if (hasInsuranceCacheFile(e.ticker) && !hasInsuranceAnalysisCache(e.ticker)) {
      cases.push({ ticker: e.ticker, reason: "Insurance cache file on disk not registered in insurance-coverage.ts" });
    }
  }

  return cases;
}

// ─── Main analysis ────────────────────────────────────────────────────────────

function main(): void {
  // Only audit tickers that don't have a full running model.
  const candidates = B3_UNIVERSE.filter(a =>
    a.coverageStatus === "quote_only" ||
    a.coverageStatus === "sector_specific_model_required" ||
    a.coverageStatus === "unavailable"
  );

  const entries = candidates.map(auditAsset);

  const byAction = new Map<SuggestedAction, AuditEntry[]>();
  for (const e of entries) {
    if (!byAction.has(e.suggestedAction)) byAction.set(e.suggestedAction, []);
    byAction.get(e.suggestedAction)!.push(e);
  }

  const suspicious = detectSuspicious(entries);

  // ── Console output ──────────────────────────────────────────────────────────

  console.log("\n══════════════════════════════════════════════════════════════════");
  console.log("  Quote-Only Coverage Audit — Fundamental Copilot BR");
  console.log(`  Inspecting ${candidates.length} non-fully-covered assets`);
  console.log("══════════════════════════════════════════════════════════════════");

  const ACTION_ORDER: SuggestedAction[] = [
    "candidate_for_cvm_mapping",
    "needs_sector_specific_model",
    "keep_quote_only",
    "manual_review",
    "mark_unavailable_or_discontinued",
    "already_has_cache_but_status_mismatch",
  ];

  const ACTION_LABEL: Record<SuggestedAction, string> = {
    candidate_for_cvm_mapping:           "Candidate for CVM mapping",
    needs_sector_specific_model:         "Needs sector-specific model",
    keep_quote_only:                     "Keep quote-only (holding/financial/not industrial)",
    manual_review:                       "Manual review (identity OK, restructuring/fit pending)",
    mark_unavailable_or_discontinued:    "Mark unavailable / discontinued",
    already_has_cache_but_status_mismatch: "⚠ Cache exists but status mismatch",
  };

  for (const action of ACTION_ORDER) {
    const group = byAction.get(action) ?? [];
    if (group.length === 0) continue;
    console.log(`\n  ${ACTION_LABEL[action]}  (${group.length})`);
    for (const e of group) {
      const cvmFlag  = e.hasCvmMapping ? " [map✓]" : "";
      const cacheFlag = e.hasCvmCache  ? ` [cache:${e.cvmCacheYears}y]` : "";
      console.log(`    ${e.ticker.padEnd(8)} ${e.companyName.slice(0,38).padEnd(39)} ${e.sector.slice(0,24)}${cvmFlag}${cacheFlag}`);
      if (e.notes !== "—") {
        console.log(`             → ${e.notes}`);
      }
    }
  }

  // ── Suspicious cases ────────────────────────────────────────────────────────

  console.log("\n──────────────────────────────────────────────────────────────────");
  if (suspicious.length === 0) {
    console.log("  ✓ No suspicious coverage cases detected.");
  } else {
    console.log(`  ⚠ ${suspicious.length} suspicious case(s):`);
    for (const s of suspicious) {
      console.log(`    ${s.ticker}: ${s.reason}`);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────

  const qoCandidates = (byAction.get("candidate_for_cvm_mapping") ?? [])
    .filter(e => e.coverageStatus === "quote_only");
  const ssNeedsModel  = (byAction.get("needs_sector_specific_model") ?? []);
  const discontinued  = (byAction.get("mark_unavailable_or_discontinued") ?? []);

  console.log("\n  Summary:");
  console.log(`    CVM mapping candidates (QO operating):  ${qoCandidates.length}`);
  console.log(`    Sector-specific model pending:          ${ssNeedsModel.length}`);
  console.log(`    Likely discontinued (CANCELADA):        ${discontinued.length}`);
  console.log(`    Keep quote-only (holding/financial):    ${(byAction.get("keep_quote_only") ?? []).length}`);
  console.log(`    Manual review:                          ${(byAction.get("manual_review") ?? []).length}`);
  console.log(`    Status mismatch (cache exists):         ${(byAction.get("already_has_cache_but_status_mismatch") ?? []).length}`);
  console.log("──────────────────────────────────────────────────────────────────\n");

  // ── Markdown report ─────────────────────────────────────────────────────────

  const docsDir = join(process.cwd(), "docs");
  if (!existsSync(docsDir)) mkdirSync(docsDir);
  writeMarkdown(entries, suspicious, docsDir);
}

// ─── Markdown generation ──────────────────────────────────────────────────────

// Everything below this marker in the existing markdown is hand-maintained
// (e.g. mapping-round notes) and is preserved across regenerations.
const MANUAL_SECTION_MARKER = "<!-- manual-sections: preserved by coverage:audit:quote-only -->";

function readManualSections(outPath: string): string | null {
  try {
    const existing = readFileSync(outPath, "utf-8");
    const idx = existing.indexOf(MANUAL_SECTION_MARKER);
    return idx >= 0 ? existing.slice(idx) : null;
  } catch { return null; }
}

function writeMarkdown(entries: AuditEntry[], suspicious: SuspiciousCase[], docsDir: string): void {
  const now = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];

  lines.push(`# Coverage Audit — Quote-Only e Cobertura Incompleta`);
  lines.push(`\n_Gerado em ${now} por \`npm run coverage:audit:quote-only\`._\n`);
  lines.push(`## Resumo\n`);
  lines.push(`| Categoria | Total |`);
  lines.push(`|---|---|`);

  const counts: Record<string, number> = {
    "Candidato mapeamento CVM": entries.filter(e => e.suggestedAction === "candidate_for_cvm_mapping").length,
    "Modelo setorial pendente":  entries.filter(e => e.suggestedAction === "needs_sector_specific_model").length,
    "Manter quote-only":         entries.filter(e => e.suggestedAction === "keep_quote_only").length,
    "Revisão manual":            entries.filter(e => e.suggestedAction === "manual_review").length,
    "Marcar descontinuado":      entries.filter(e => e.suggestedAction === "mark_unavailable_or_discontinued").length,
    "Mismatch cache/status":     entries.filter(e => e.suggestedAction === "already_has_cache_but_status_mismatch").length,
  };
  for (const [label, count] of Object.entries(counts)) {
    lines.push(`| ${label} | ${count} |`);
  }

  if (suspicious.length > 0) {
    lines.push(`\n## Casos Suspeitos\n`);
    for (const s of suspicious) {
      lines.push(`- **${s.ticker}**: ${s.reason}`);
    }
  }

  lines.push(`\n## Candidatos a Mapeamento CVM\n`);
  lines.push(`Empresas operacionais com \`quote_only\` que provavelmente têm CNPJ ativo na CVM e poderiam ser incluídas no pipeline de dados.\n`);
  lines.push(`| Ticker | Empresa | Setor | Notas |`);
  lines.push(`|---|---|---|---|`);
  for (const e of entries.filter(e => e.suggestedAction === "candidate_for_cvm_mapping" && e.coverageStatus === "quote_only")) {
    lines.push(`| ${e.ticker} | ${e.companyName} | ${e.sector} | ${e.notes} |`);
  }

  lines.push(`\n## Modelo Setorial Pendente\n`);
  lines.push(`Ativos que exigem modelo setorial (\`sector_specific_model_required\`, ou \`quote_only\` revisados como inadequados ao modelo industrial).\n`);
  lines.push(`| Ticker | Empresa | Status | Tipo | Rota | Notas |`);
  lines.push(`|---|---|---|---|---|---|`);
  for (const e of entries.filter(e => e.suggestedAction === "needs_sector_specific_model")) {
    lines.push(`| ${e.ticker} | ${e.companyName} | ${e.coverageStatus} | ${e.richType} | ${e.modelRoute} | ${e.notes} |`);
  }

  lines.push(`\n## Prováveis Descontinuados\n`);
  lines.push(`Entidade CVM CANCELADA no registro ou código de negociação obsoleto. Recomendação: \`coverageStatus\` = \`"unavailable"\`.\n`);
  for (const e of entries.filter(e => e.suggestedAction === "mark_unavailable_or_discontinued")) {
    lines.push(`- **${e.ticker}** — ${e.companyName} (status atual: \`${e.coverageStatus}\`)`);
  }

  lines.push(`\n## Manter Quote-Only\n`);
  lines.push(`Holdings financeiras ou estruturas sem modelo industrial aplicável.\n`);
  for (const e of entries.filter(e => e.suggestedAction === "keep_quote_only")) {
    lines.push(`- **${e.ticker}** — ${e.companyName} (${e.sector})${e.notes !== "—" ? ` — ${e.notes}` : ""}`);
  }

  lines.push(`\n## Revisão Manual\n`);
  lines.push(`Identidade CVM verificada, mas reestruturação societária ou adequação ao modelo industrial ainda pendente.\n`);
  for (const e of entries.filter(e => e.suggestedAction === "manual_review")) {
    lines.push(`- **${e.ticker}** — ${e.companyName} — ${e.notes}`);
  }

  lines.push(`\n---\n_Para atualizar: \`npm run coverage:audit:quote-only\`_`);

  const outPath = join(docsDir, "coverage-audit-quote-only.md");
  const manual = readManualSections(outPath);
  if (manual) lines.push(`\n${manual.trimEnd()}`);
  writeFileSync(outPath, lines.join("\n") + "\n");
  console.log(`  Markdown report written → docs/coverage-audit-quote-only.md`);
}

main();
