// Product readiness: is an asset actually covered at the intended level?
//
// Deliberately separate from:
//   - resolveModelRoute()  → which page/model renders (rendering safety);
//   - coverageStatus       → static capability metadata in B3_UNIVERSE;
//   - ticker lifecycle     → whether the trading code itself is current.
// A fallback page that renders safely is NOT "ready".
//
// Pure functions — inputs come from asset-readiness-inputs.ts (fs) or tests.
// No @/ imports — also used by tsx scripts.

import type { ModelRoute } from "./model-routing";
import type { AssetType } from "./coverage-types";
import type { TickerLifecycle } from "./ticker-lifecycle";
import type { FundamentalsAlias } from "./fundamentals-alias";
import { FII_MAX_DISTRIBUTION_LAG_MONTHS } from "../fiis/fii-indicators";

export type AssetReadiness =
  /** Operational model with sufficient data. */
  | "analysis_ready"
  /** Model works but data/history is insufficient (≤ 1 fiscal year, or no
   *  fiscal year that reflects the current business — explicit decision). */
  | "analysis_limited"
  /** ETF/BDR informational layer by design (not a corporate model). */
  | "informational_ready"
  /** Quote-only by explicit methodological decision. */
  | "intentionally_limited"
  /** Current asset needs a model that does not exist yet. */
  | "model_pending"
  /** The model exists but this asset has no usable cache/mapping yet. */
  | "cache_pending"
  /** Restructuring or comparability problems prevent normal model use. */
  | "manual_review"
  /** Trading code no longer current (successor, if any, is in the universe). */
  | "historical_or_unavailable"
  /** Historical code whose current successor is missing from the universe. */
  | "current_ticker_missing";

export const READINESS_ORDER: readonly AssetReadiness[] = [
  "analysis_ready",
  "analysis_limited",
  "informational_ready",
  "intentionally_limited",
  "manual_review",
  "model_pending",
  "cache_pending",
  "historical_or_unavailable",
  "current_ticker_missing",
];

export type ModelProject = "holding" | "real_estate" | "market_infrastructure";

export const MODEL_PROJECT_LABEL: Readonly<Record<ModelProject, string>> = {
  holding: "Holding model",
  real_estate: "Real estate / shopping-center model",
  market_infrastructure: "Market-infrastructure model",
};

/**
 * The issuer's history predates its current business (e.g. a combination
 * consolidated after the last DFP). Consumed by coverage/comparability.ts.
 */
export interface ComparabilityBreak {
  /** Last fiscal year whose annual statements predate the current business. */
  lastPreBreakFiscalYear: number;
  /** First quarter that reflects the current business. */
  firstComparableQuarter: { fiscalYear: number; quarter: number };
  /** User-facing explanation (Portuguese). */
  notePt: string;
}

export interface ReadinessDecision {
  readiness: Extract<AssetReadiness, "manual_review" | "intentionally_limited" | "model_pending" | "analysis_limited">;
  modelProject?: ModelProject;
  reason: string;
  /** Overrides the default next action for the bucket. */
  nextAction?: string;
  comparabilityBreak?: ComparabilityBreak;
  /** Re-verified on 2026-11-03 unless stated otherwise in the reason. */
  evidence: string;
}

/**
 * Explicit methodological decisions. They override cache/route-derived
 * readiness for active tickers (never for historical ones).
 */
export const READINESS_DECISIONS: Readonly<Record<string, ReadinessDecision>> = {
  ITSA3: { readiness: "model_pending", modelProject: "holding",
    reason: "Itaúsa is a holding (equity-accounted stakes in Itaú Unibanco and non-financial companies) — not a bank and not an operating company",
    evidence: "CVM 7617 ATIVO; B3 codes ITSA3, ITSA4 (same issuer)" },
  ITSA4: { readiness: "model_pending", modelProject: "holding",
    reason: "Itaúsa is a holding (equity-accounted stakes in Itaú Unibanco and non-financial companies) — not a bank and not an operating company",
    evidence: "CVM 7617 ATIVO; B3 codes ITSA3, ITSA4 (same issuer)" },
  BRAP4: { readiness: "model_pending", modelProject: "holding",
    reason: "Bradespar is a pure holding whose main asset is a Vale stake — industrial DFP metrics do not describe it",
    evidence: "CVM 18724 ATIVO; B3 codes BRAP3, BRAP4" },
  ALOS3: { readiness: "model_pending", modelProject: "real_estate",
    reason: "Shopping-center owner: needs NOI/FFO/NAV metrics; extracted DFP showed total debt = 0 and 2023 EBIT ≈ 2× revenue (combination gain)",
    evidence: "CVM 22357 ATIVO; B3 ALOS3; DFP findings recorded in docs/coverage-audit-quote-only.md" },
  B3SA3: { readiness: "model_pending", modelProject: "market_infrastructure",
    reason: "Exchange/clearing operator — revenue and balance sheet (collateral, clearing) need a market-infrastructure model",
    evidence: "CVM 21610 ATIVO; B3 B3SA3" },
  VAMO3: { readiness: "manual_review",
    reason: "2024 reorganisation (dealerships segregated into Automob/AMOB3) breaks 2020–2023 comparability; fleet purchases in operating cash flow distort industrial FCF",
    evidence: "CVM 24716 ATIVO; B3 VAMO3; reorganisation evidence recorded in docs/coverage-audit-quote-only.md (2026 review)" },
  SEQL3: { readiness: "manual_review",
    reason: "Extrajudicial recovery (2024), reverse splits, change of control and debt renegotiation (2026) — wait for stabilisation",
    evidence: "CVM 25160 ATIVO; B3 SEQL3; restructuring evidence recorded in docs/coverage-audit-quote-only.md (2026 review)" },
  AMBP3: { readiness: "manual_review",
    reason: "Judicial recovery (recuperação judicial) since 2025-10-30 — restructuring prevents normal model use",
    evidence: "CVM 24961 ATIVO; FCA 2026 registered name 'AMBIPAR PARTICIP. E EMPREEND. S.A. - EM RECUPERAÇÃO JUDICIAL'" },
  BHIA3: { readiness: "manual_review",
    reason: "Grupo Casas Bahia is in judicial recovery; no CVM cache under the current code yet (VVAR3/VIIA3 history not cached)",
    evidence: "CVM 6505 ATIVO; FCA 2026 registered name 'Grupo Casas Bahia S.A. - Em Recuperação Judicial'; B3 BHIA3" },
  AZUL3: { readiness: "manual_review",
    reason: "Chapter 11 restructuring: all PN converted into ON (Jan/2026) and new equity issued — per-share history is not comparable",
    evidence: "CVM 24112 ATIVO; FCA 2026 lists only AZUL3; B3 AZUL3 only" },
  AUAU3: { readiness: "analysis_limited",
    reason: "New issuer (former Cobasi, CNPJ 53.153.938/0001-08): FY2023–2025 DFPs are Cobasi standalone; Petz is consolidated only from 2026Q1 — no fiscal year reflects the combined business",
    nextAction: "Re-assess after the FY2026 DFP (first combined fiscal year)",
    comparabilityBreak: {
      lastPreBreakFiscalYear: 2025,
      firstComparableQuarter: { fiscalYear: 2026, quarter: 1 },
      notePt: "Os dados anuais anteriores a 2026 referem-se à Cobasi antes da combinação com a Petz. A Petz é consolidada apenas a partir do 1º trimestre de 2026, enquanto a cotação e o valor de mercado de AUAU3 refletem a União Pet combinada. Múltiplos de mercado e projeções ficam suspensos até haver histórico suficiente da companhia combinada (reavaliação após a DFP de 2026).",
    },
    evidence: "CVM 27766 ATIVO; FCA 2024–2025 name Cobasi Comércio de Produtos Básicos e Industrializados S.A., FCA 2026 União Pet Participações S.A., AUAU3 from 2026-01-05; ITR 2026Q1 revenue R$1.69bn vs R$0.80bn in 2025Q4" },
  CASH3: { readiness: "intentionally_limited",
    reason: "Business model pivoted to a Bitcoin treasury strategy (2025–2026) — industrial metrics would mislead",
    evidence: "CVM 25232 ATIVO; B3 CASH3; material facts recorded in docs/coverage-audit-quote-only.md (2026 review)" },
};

/**
 * Assets currently analysed by the industrial model whose business may need
 * a sector model. Flagged in the audit only — NOT reclassified.
 */
export const INDUSTRIAL_REVIEW_CANDIDATES: Readonly<Record<string, { modelProject: ModelProject; reason: string }>> = {
  MULT3:  { modelProject: "real_estate", reason: "Shopping-center owner (same business as ALOS3, which is excluded)" },
  IGTI11: { modelProject: "real_estate", reason: "Shopping-center owner (same business as ALOS3, which is excluded)" },
  JHSF3:  { modelProject: "real_estate", reason: "Shopping centers, real-estate development and hospitality mix" },
  CSAN3:  { modelProject: "holding", reason: "Holding with equity-accounted (Raízen) and consolidated stakes; part of value sits outside consolidated DFP" },
  GOAU4:  { modelProject: "holding", reason: "Holding of Gerdau (consolidated) — double-counts GGBR3/GGBR4 fundamentals" },
};

export interface ReadinessInput {
  ticker: string;
  companyName: string;
  coverageStatus: string;
  richType: AssetType;
  route: ModelRoute;
  lifecycle: TickerLifecycle | null;
  /** Successor present in the universe (only meaningful with a successor). */
  successorInUniverse: boolean;
  alias: FundamentalsAlias | null;
  /** Fiscal years in the (alias-resolved) annual CVM cache; null = no cache file. */
  annualYears: number | null;
  hasQuarterly: boolean;
  /**
   * FII only: months with a usable distribution among the latest 12 monthly
   * records (computeFiiIndicators' distributionCoverageMonths); null = no FII cache.
   */
  fiiDistributionMonths?: number | null;
  // Latest NAV month minus latest distribution month (FII caches only).
  fiiDistributionLagMonths?: number | null;
  decision: ReadinessDecision | null;
}

/**
 * Distribution is a material FII metric: the 12-month yield is only complete
 * (the panel stops warning "DY 12m pode estar subestimado") with all 12 months.
 * An FII is analysis_ready only with 12/12 covered months AND a latest
 * distribution no more than FII_MAX_DISTRIBUTION_LAG_MONTHS behind its latest
 * NAV month (fii-indicators.ts).
 */
export const FII_MIN_DISTRIBUTION_MONTHS = 12;

export interface ReadinessResult {
  ticker: string;
  readiness: AssetReadiness;
  reason: string;
  nextAction: string | null;
  modelProject?: ModelProject;
  fundamentalsTicker?: string;
  successorTicker?: string;
  reviewFlag?: { modelProject: ModelProject; reason: string };
}

export function classifyAssetReadiness(input: ReadinessInput): ReadinessResult {
  const base = {
    ticker: input.ticker,
    ...(input.alias ? { fundamentalsTicker: input.alias.fundamentalsTicker } : {}),
  };

  // 1. Historical codes — lifecycle wins over everything else.
  if (input.lifecycle) {
    const lc = input.lifecycle;
    const successor = lc.successorTicker;
    if (successor && !input.successorInUniverse) {
      return { ...base, successorTicker: successor, readiness: "current_ticker_missing",
        reason: `${lc.status}: current code ${successor} is not in the universe`,
        nextAction: `Add ${successor} to B3_UNIVERSE with an honest coverage state` };
    }
    return { ...base, ...(successor ? { successorTicker: successor } : {}), readiness: "historical_or_unavailable",
      reason: successor ? `${lc.status} → ${successor}` : `${lc.status} (no B3 successor)`,
      nextAction: lc.verification === "needs_manual_verification" ? "Confirm corporate-action details in issuer IR" : null };
  }
  if (input.coverageStatus === "unavailable") {
    return { ...base, readiness: "historical_or_unavailable",
      reason: "declared unavailable without lifecycle metadata",
      nextAction: "Add a TICKER_LIFECYCLE entry with evidence" };
  }

  const reviewFlag = INDUSTRIAL_REVIEW_CANDIDATES[input.ticker];
  const flag = reviewFlag && input.route === "industrial" ? { reviewFlag } : {};

  // 2. Explicit methodological decisions. An analysis_limited decision only
  // qualifies data that exists — without an industrial cache it falls through.
  const limitedWithoutData = input.decision?.readiness === "analysis_limited"
    && (input.route !== "industrial" || input.annualYears === null);
  if (input.decision && !limitedWithoutData) {
    const d = input.decision;
    return { ...base, readiness: d.readiness, reason: d.reason,
      ...(d.modelProject ? { modelProject: d.modelProject } : {}),
      nextAction: d.nextAction ?? (d.readiness === "model_pending" ? `Build the ${MODEL_PROJECT_LABEL[d.modelProject!].toLowerCase()}`
        : d.readiness === "manual_review" ? "Re-assess comparability before enabling a model" : null) };
  }

  // 3. Route-derived readiness.
  switch (input.route) {
    case "informational_instrument":
      return { ...base, readiness: "informational_ready", reason: "ETF/BDR informational layer by design", nextAction: null };
    case "fii":
      if (input.fiiDistributionMonths != null && input.fiiDistributionMonths < FII_MIN_DISTRIBUTION_MONTHS) {
        return { ...base, readiness: "analysis_limited",
          reason: `FII cache has usable distributions in ${input.fiiDistributionMonths} of the latest 12 months (needs ${FII_MIN_DISTRIBUTION_MONTHS})`,
          nextAction: "Re-run fii:precompute once Fundos.Net has the missing distribution notices" };
      }
      if (input.fiiDistributionLagMonths != null && input.fiiDistributionLagMonths > FII_MAX_DISTRIBUTION_LAG_MONTHS) {
        return { ...base, readiness: "analysis_limited",
          reason: `FII latest distribution is ${input.fiiDistributionLagMonths} months behind the latest NAV month (max ${FII_MAX_DISTRIBUTION_LAG_MONTHS})`,
          nextAction: "Re-run fii:precompute once Fundos.Net has the newer distribution notices" };
      }
    // falls through
    case "bank":
    case "insurance":
      return { ...base, readiness: "analysis_ready",
        reason: input.alias ? `${input.route} model via same-issuer alias ${input.alias.fundamentalsTicker}` : `${input.route} model cache available`,
        nextAction: null };
    case "industrial": {
      if (input.annualYears === null) {
        return { ...base, ...flag, readiness: "cache_pending", reason: "industrial route without an annual CVM cache",
          nextAction: "Run cvm:precompute for this ticker" };
      }
      if (input.annualYears <= 1) {
        return { ...base, ...flag, readiness: "analysis_limited",
          reason: `annual CVM cache has ${input.annualYears} fiscal year(s)`, nextAction: "Investigate missing DFP history" };
      }
      return { ...base, ...flag, readiness: "analysis_ready",
        reason: `${input.annualYears} fiscal years${input.hasQuarterly ? " + quarterly" : ""}${input.alias ? ` via same-issuer alias ${input.alias.fundamentalsTicker}` : ""}`,
        nextAction: input.alias && input.alias.reason !== "same_issuer_share_class" ? `Re-key caches under ${input.ticker} at the next precompute` : null };
    }
    case "sector_specific_pending":
      if (input.richType === "bank" || input.richType === "fii" || input.richType === "insurance") {
        return { ...base, readiness: "cache_pending",
          reason: `${input.richType} model exists but no available:true cache for this ticker`,
          nextAction: `Verify identity and run ${input.richType === "fii" ? "fii" : input.richType}:precompute` };
      }
      return { ...base, readiness: "model_pending", reason: `no model for asset type ${input.richType}`,
        nextAction: "Classify and decide on a model" };
    case "quote_only":
      return { ...base, readiness: "cache_pending",
        reason: "operating company without a verified CVM mapping/cache under this code",
        nextAction: "Verify CVM identity, add company-map entry and run cvm:precompute" };
    case "unavailable":
      return { ...base, readiness: "historical_or_unavailable", reason: "unavailable route", nextAction: null };
  }
}

/** Groups model-pending results by model project and issuer (not raw tickers). */
export function groupModelProjects(
  results: readonly ReadinessResult[],
  issuerOf: (ticker: string) => { key: string; name: string },
): Map<ModelProject, Map<string, { name: string; tickers: string[]; reviewOnly: boolean }>> {
  const out = new Map<ModelProject, Map<string, { name: string; tickers: string[]; reviewOnly: boolean }>>();
  const add = (project: ModelProject, ticker: string, reviewOnly: boolean) => {
    const issuer = issuerOf(ticker);
    if (!out.has(project)) out.set(project, new Map());
    const byIssuer = out.get(project)!;
    const entry = byIssuer.get(issuer.key) ?? { name: issuer.name, tickers: [], reviewOnly };
    entry.tickers.push(ticker);
    entry.reviewOnly = entry.reviewOnly && reviewOnly;
    byIssuer.set(issuer.key, entry);
  };
  for (const r of results) {
    if (r.readiness === "model_pending" && r.modelProject) add(r.modelProject, r.ticker, false);
    else if (r.reviewFlag) add(r.reviewFlag.modelProject, r.ticker, true);
  }
  for (const byIssuer of out.values()) for (const e of byIssuer.values()) e.tickers.sort();
  return out;
}
