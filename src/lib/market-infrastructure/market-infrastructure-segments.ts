// Revenue segments from CVM consolidated gross-revenue sub-accounts (3.01.0x).
//
// Current taxonomy only (Mercados, Soluções Analíticas de Dados, Soluções para
// o Mercado de Capitais, Tecnologia & Plataformas, Outras receitas), from
// FY2024 (restated comparative) onward. The pre-2025 taxonomy is recognised
// and skipped — never back-cast.
//
// Every snapshot comes from ONE filing and one period: the latest quarter,
// the current year-to-date or a fiscal year. There is deliberately no segment
// TTM: B3 restates comparative allocations (2T26 moved 6.5mn of 1S25 from
// Tecnologia & Plataformas to Outras receitas), so combining filings would
// create segment values no filing reports. Company-level TTM uses totals only.
//
// A snapshot is valid only when every sub-line maps to a verified segment
// (code + label) and Σ lines reconciles to 3.01 of the same filing and period;
// otherwise the whole snapshot is rejected — never partially kept.
//
// No @/ imports — also used by tsx scripts.

import type { RawFiling } from "./market-infrastructure-cvm-rows";
import type { RevenueSegmentLine, RevenueSegmentSnapshot, SegmentPeriodKind } from "./market-infrastructure-types";
import {
  CURRENT_SEGMENT_TAXONOMY,
  FIXED_ACCOUNTS,
  LEGACY_SEGMENT_LABELS,
  REVENUE_TAX_DESCRIPTIONS,
  SEGMENT_HISTORY_START_YEAR,
  matchesAny,
  normalizeDescription,
} from "./market-infrastructure-identity";
import { quarterOf } from "./market-infrastructure-statements";

/** Σ lines vs 3.01: CVM files thousands, so one thousand of rounding. */
export const SEGMENT_SUM_TOLERANCE_BRL = 1_000;

/** The segment taxonomy must contain these; Outras receitas is optional. */
const REQUIRED_SEGMENTS = ["mercados", "solucoes_analiticas_de_dados", "solucoes_para_mercado_de_capitais", "tecnologia_e_plataformas"] as const;

export type SegmentParse =
  | { status: "ok"; snapshot: RevenueSegmentSnapshot }
  | { status: "legacy_taxonomy"; reason: string }
  | { status: "invalid"; reason: string };

interface PeriodSpec {
  periodStart: string;
  periodEnd: string;
  periodKind: SegmentPeriodKind;
  comparative: boolean;
}

export function parseSegmentPeriod(filing: RawFiling, spec: PeriodSpec): SegmentParse {
  const rows = filing.rows.filter(x =>
    x.statement === "DRE" &&
    x.order === (spec.comparative ? "comparative" : "current") &&
    x.periodStart === spec.periodStart &&
    x.periodEnd === spec.periodEnd);
  const where = `${filing.document} ${filing.filingReferenceDate} ${spec.periodKind} ${spec.periodStart}..${spec.periodEnd}`;

  const totalRows = rows.filter(x => x.code === FIXED_ACCOUNTS.grossRevenue.code);
  if (totalRows.length !== 1 || normalizeDescription(totalRows[0].description) !== normalizeDescription(FIXED_ACCOUNTS.grossRevenue.description)) {
    return { status: "invalid", reason: `${where}: 3.01 missing, duplicated or relabelled` };
  }
  const children = rows.filter(x => x.code.startsWith("3.01.") && x.code.split(".").length === 3);
  if (children.some(x => matchesAny(LEGACY_SEGMENT_LABELS, x.description))) {
    return { status: "legacy_taxonomy", reason: `${where}: pre-2025 segment taxonomy (not back-cast)` };
  }
  const taxes = children.filter(x => matchesAny(REVENUE_TAX_DESCRIPTIONS, x.description));
  const revenueLines = children.filter(x => !taxes.includes(x));
  if (revenueLines.length === 0) return { status: "invalid", reason: `${where}: no segment sub-lines under 3.01` };

  const lines: Omit<RevenueSegmentLine, "share">[] = [];
  for (const row of revenueLines) {
    const def = CURRENT_SEGMENT_TAXONOMY.find(d => d.code === row.code && matchesAny(d.labels, row.description));
    if (!def) return { status: "invalid", reason: `${where}: unrecognised segment line ${row.code} "${row.description}"` };
    if (lines.some(l => l.segmentId === def.id)) return { status: "invalid", reason: `${where}: segment ${def.id} filed twice` };
    lines.push({ segmentId: def.id, code: row.code, label: row.description, value: row.value });
  }
  const missing = REQUIRED_SEGMENTS.filter(id => !lines.some(l => l.segmentId === id));
  if (missing.length > 0) return { status: "invalid", reason: `${where}: segments missing (${missing.join(", ")})` };

  const sumOfLines = lines.reduce((s, l) => s + l.value, 0);
  const grossRevenue = totalRows[0].value - taxes.reduce((s, x) => s + x.value, 0);
  const difference = sumOfLines - grossRevenue;
  const passed = Math.abs(difference) <= SEGMENT_SUM_TOLERANCE_BRL;
  if (!passed || sumOfLines === 0) {
    return { status: "invalid", reason: `${where}: Σ segment lines ${sumOfLines} ≠ gross revenue ${grossRevenue} (difference ${difference})` };
  }
  return {
    status: "ok",
    snapshot: {
      periodStart: spec.periodStart,
      periodEnd: spec.periodEnd,
      periodKind: spec.periodKind,
      source: { document: filing.document, filingReferenceDate: filing.filingReferenceDate, filingVersion: filing.version, comparative: spec.comparative },
      taxonomy: "current_2025",
      lines: lines.map(l => ({ ...l, share: Math.round((l.value / sumOfLines) * 1e6) / 1e6 })),
      reconciliation: { sumOfLines, grossRevenue, difference, tolerance: SEGMENT_SUM_TOLERANCE_BRL, passed },
    },
  };
}

const QUARTER_START: Record<number, string> = { 2: "04-01", 3: "07-01" };

/** Approved segment periods carried by one filing: FY (DFP, incl. the restated prior FY), YTD and quarter (ITR). */
export function segmentPeriodsOf(filing: RawFiling): PeriodSpec[] {
  const end = filing.filingReferenceDate;
  const year = Number(end.slice(0, 4));
  const quarter = quarterOf(end);
  if (quarter === null) return [];
  if (filing.document === "DFP") {
    return [
      { periodStart: `${year}-01-01`, periodEnd: end, periodKind: "fy", comparative: false },
      { periodStart: `${year - 1}-01-01`, periodEnd: `${year - 1}-12-31`, periodKind: "fy", comparative: true },
    ];
  }
  if (quarter === 1) return [{ periodStart: `${year}-01-01`, periodEnd: end, periodKind: "quarter", comparative: false }];
  return [
    { periodStart: `${year}-01-01`, periodEnd: end, periodKind: "ytd", comparative: false },
    { periodStart: `${year}-${QUARTER_START[quarter]}`, periodEnd: end, periodKind: "quarter", comparative: false },
  ];
}

export interface SegmentCandidates {
  snapshots: RevenueSegmentSnapshot[];
  /** Invalid parses (unknown labels, failed reconciliation) — legacy taxonomy is not an issue. */
  issues: { filingReferenceDate: string; document: "DFP" | "ITR"; comparative: boolean; reason: string }[];
}

export function collectSegmentCandidates(filings: readonly RawFiling[]): SegmentCandidates {
  const out: SegmentCandidates = { snapshots: [], issues: [] };
  for (const filing of filings) {
    for (const spec of segmentPeriodsOf(filing)) {
      if (Number(spec.periodEnd.slice(0, 4)) < SEGMENT_HISTORY_START_YEAR) continue;
      const parsed = parseSegmentPeriod(filing, spec);
      if (parsed.status === "ok") out.snapshots.push(parsed.snapshot);
      else if (parsed.status === "invalid") {
        out.issues.push({ filingReferenceDate: filing.filingReferenceDate, document: filing.document, comparative: spec.comparative, reason: parsed.reason });
      }
    }
  }
  return out;
}

export interface SegmentSelection {
  snapshots: RevenueSegmentSnapshot[];
  /** Latest-filing segments are valid (the current mix can be shown). */
  latestValid: boolean;
  issues: string[];
}

const key = (s: RevenueSegmentSnapshot) => `${s.periodKind}|${s.periodStart}|${s.periodEnd}`;
const KIND_ORDER: Record<SegmentPeriodKind, number> = { fy: 0, ytd: 1, quarter: 2 };

/**
 * Keeps only approved periods:
 *   - each FY ≥ 2024 — from its own DFP, or the next DFP's restated comparative
 *     when the own DFP used the legacy taxonomy;
 *   - the latest statement filing's own YTD and quarter (FY for a DFP).
 * Interim comparatives and older interim periods are dropped.
 */
export function selectSegmentHistory(candidates: SegmentCandidates, latestPeriodEnd: string | null): SegmentSelection {
  const chosen = new Map<string, RevenueSegmentSnapshot>();
  for (const s of candidates.snapshots.filter(x => x.periodKind === "fy" && !x.source.comparative)) chosen.set(key(s), s);
  for (const s of candidates.snapshots.filter(x => x.periodKind === "fy" && x.source.comparative)) {
    if (!chosen.has(key(s))) chosen.set(key(s), s);
  }
  for (const s of candidates.snapshots.filter(x => x.periodKind !== "fy" && !x.source.comparative && x.source.filingReferenceDate === latestPeriodEnd)) {
    chosen.set(key(s), s);
  }
  const latestIssues = candidates.issues.filter(i => i.filingReferenceDate === latestPeriodEnd && !i.comparative);
  const latestValid = latestPeriodEnd !== null &&
    latestIssues.length === 0 &&
    [...chosen.values()].some(s => s.source.filingReferenceDate === latestPeriodEnd && !s.source.comparative);
  return {
    snapshots: [...chosen.values()].sort((a, b) => a.periodEnd.localeCompare(b.periodEnd) || KIND_ORDER[a.periodKind] - KIND_ORDER[b.periodKind]),
    latestValid,
    issues: candidates.issues.map(i => i.reason),
  };
}

/** The current mix: the latest filing's quarter snapshot, else its FY/YTD snapshot. Never a TTM. */
export function currentSegmentSnapshot(snapshots: readonly RevenueSegmentSnapshot[], latestPeriodEnd: string | null): RevenueSegmentSnapshot | null {
  const own = snapshots.filter(s => s.source.filingReferenceDate === latestPeriodEnd && !s.source.comparative && s.periodEnd === latestPeriodEnd);
  return own.find(s => s.periodKind === "quarter") ?? own.find(s => s.periodKind === "fy") ?? own.find(s => s.periodKind === "ytd") ?? null;
}
