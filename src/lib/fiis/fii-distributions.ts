// Monthly FII distributions from B3 Fundos.Net structured notices, merged over
// the CVM informe mensal records. Pure — the network lives in fii-fnet-client.ts.
//
// Pipeline (each step is a separate function so it can be tested alone):
//   matchEventIdentity    exact CNPJ + ISIN + ticker, no name matching
//   parseCompetenceMonth  PeriodoReferencia → yyyy-mm (the economic month)
//   selectFundEvents      active notices only; one winner per event
//   aggregateByMonth      sum rendimentos per month, amortizações apart
//   mergeDistributions    CVM months ∪ Fundos.Net months; distribution = Fundos.Net only
//
// Month rule: an event belongs to the month named in PeriodoReferencia, which
// is the month the CVM informe reports the same distribution under (see
// docs/fii-distribution-source.md). The data base and payment dates are often
// in the following month and are kept only as provenance.

import type { FetchedFnetNotice } from "./fii-fnet-client";
import type { FnetDistributionEvent, FnetEventKind, FnetNoticeListing } from "./fii-fnet-parser";
import type { FiiAnalysisResponse, FiiDistributionEnrichment, FiiFinancialRecord } from "./fii-types";

export interface FiiFundIdentity {
  ticker: string;
  cnpj: string;
  // ISIN of the traded quota; null when unknown (CNPJ + ticker must then agree).
  isin: string | null;
}

// ── Identity ──────────────────────────────────────────────────────────────────

export type IdentityMatch = "match" | "other_quota" | "isin_mismatch" | "ticker_mismatch" | "cnpj_mismatch";

/**
 * Every identifier present must agree. Other quotas of the same fund (subscription
 * receipts such as KNCR13, older classes) are "other_quota" and ignored.
 */
export function matchEventIdentity(
  identity: FiiFundIdentity,
  noticeCnpj: string,
  event: Pick<FnetDistributionEvent, "isin" | "ticker">,
): IdentityMatch {
  if (noticeCnpj.replace(/\D/g, "") !== identity.cnpj.replace(/\D/g, "")) return "cnpj_mismatch";
  const tickerMatches = event.ticker.toUpperCase() === identity.ticker.toUpperCase();
  const isinMatches = identity.isin === null || event.isin.toUpperCase() === identity.isin.toUpperCase();
  if (tickerMatches) return isinMatches ? "match" : "isin_mismatch";
  if (identity.isin !== null && isinMatches) return "ticker_mismatch";
  return "other_quota";
}

// ── Competence month ──────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

export type CompetenceResult = { month: string } | { error: string };

/**
 * Formats observed in notices: "Setembro-2026", "OUTUBRO 2025", "05/2025" and,
 * from some administrators, the bare month name ("OUTUBRO", "junho"). A bare
 * month takes the latest such month on or before the data base. Anything else
 * — or a month after the data base — is an error, never a guess.
 */
export function parseCompetenceMonth(periodText: string, baseDate: string | null): CompetenceResult {
  const s = periodText.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  let month: number | null = null;
  let year: number | null = null;

  const numeric = /^(\d{1,2})\/(\d{4})$/.exec(s);
  const named = /^([a-z]+)(?:\s*[-/ ]\s*(\d{4}))?$/.exec(s);
  if (numeric) {
    month = Number(numeric[1]);
    year = Number(numeric[2]);
  } else if (named && MONTHS[named[1]]) {
    month = MONTHS[named[1]];
    year = named[2] ? Number(named[2]) : null;
  }
  if (month === null || month < 1 || month > 12) return { error: `unrecognised PeriodoReferencia "${periodText}"` };

  const base = baseDate ? { y: Number(baseDate.slice(0, 4)), m: Number(baseDate.slice(5, 7)) } : null;
  if (year === null) {
    if (!base) return { error: `PeriodoReferencia "${periodText}" has no year and no data base` };
    year = month <= base.m ? base.y : base.y - 1;
  }
  const competence = `${year}-${String(month).padStart(2, "0")}`;
  if (base && competence > `${base.y}-${String(base.m).padStart(2, "0")}`) {
    return { error: `PeriodoReferencia "${periodText}" is after data base ${baseDate}` };
  }
  return { month: competence };
}

// ── Event selection ───────────────────────────────────────────────────────────

export interface SelectedFnetEvent {
  kind: FnetEventKind;
  month: string;
  valuePerShare: number;
  baseDate: string | null;
  paymentDate: string | null;
  documentId: number;
}

export interface EventSelection {
  events: SelectedFnetEvent[];
  issues: string[];
}

interface Candidate extends SelectedFnetEvent {
  listing: FnetNoticeListing;
}

// Later version, then later delivery, then higher id. Independent of input order.
function outranks(a: FnetNoticeListing, b: FnetNoticeListing): boolean {
  if (a.version !== b.version) return a.version > b.version;
  if (a.deliveredAt !== b.deliveredAt) return a.deliveredAt > b.deliveredAt;
  return a.id > b.id;
}

/**
 * Only active notices contribute: superseded (replaced by a reapresentação) and
 * cancelled ones never do. When more than one active notice reports the same
 * event — same kind, data base and month for the quota — the highest-ranked one
 * is kept and the duplicate is reported, so nothing is counted twice.
 */
export function selectFundEvents(identity: FiiFundIdentity, notices: readonly FetchedFnetNotice[]): EventSelection {
  const issues: string[] = [];
  const byKey = new Map<string, Candidate>();
  const dropped = new Map<string, number[]>();

  for (const { listing, notice, error } of notices) {
    if (listing.status === "unknown") issues.push(`notice ${listing.id}: unknown listing status, ignored`);
    if (listing.status !== "active") continue;
    if (!notice) { issues.push(`notice ${listing.id}: ${error ?? "not downloaded"}`); continue; }

    for (const event of notice.events) {
      const match = matchEventIdentity(identity, notice.cnpj, event);
      if (match === "other_quota") continue;
      if (match !== "match") {
        issues.push(`notice ${listing.id}: ${match} (${event.ticker} ${event.isin}), ignored`);
        continue;
      }
      if (event.valuePerShare === null) {
        issues.push(`notice ${listing.id}: ${event.kind} without a numeric value, ignored`);
        continue;
      }
      const competence = parseCompetenceMonth(event.periodText, event.baseDate);
      if ("error" in competence) {
        issues.push(`notice ${listing.id}: ${competence.error}, ignored`);
        continue;
      }
      const candidate: Candidate = {
        kind: event.kind,
        month: competence.month,
        valuePerShare: event.valuePerShare,
        baseDate: event.baseDate,
        paymentDate: event.paymentDate,
        documentId: listing.id,
        listing,
      };
      const key = `${event.kind}|${competence.month}|${event.baseDate ?? ""}`;
      const current = byKey.get(key);
      if (!current) { byKey.set(key, candidate); continue; }
      const [keep, drop] = outranks(listing, current.listing) ? [candidate, current] : [current, candidate];
      byKey.set(key, keep);
      dropped.set(key, [...(dropped.get(key) ?? []), drop.documentId]);
    }
  }

  for (const [key, ids] of [...dropped].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const kept = byKey.get(key)!;
    issues.push(`duplicate active notices for ${kept.kind} ${kept.month} (data base ${kept.baseDate}): kept ${kept.documentId}, dropped ${[...ids].sort((a, b) => a - b).join(", ")}`);
  }

  const events = [...byKey.values()]
    .map(({ listing: _listing, ...e }) => e)
    .sort((a, b) => (a.month !== b.month ? (a.month < b.month ? -1 : 1) : a.documentId - b.documentId));
  return { events, issues };
}

// ── Monthly aggregation ───────────────────────────────────────────────────────

export interface MonthlyFnetDistribution {
  month: string;
  // Sum of rendimentos; null when the month has only amortizações.
  distributionPerShare: number | null;
  amortizationPerShare: number | null;
  baseDate: string | null;
  paymentDate: string | null;
  documentIds: number[];
}

// Strips binary float noise (0.1 + 0.2) so cache output is stable.
function roundPerShare(v: number): number {
  return Math.round(v * 1e10) / 1e10;
}

function laterDate(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a > b ? a : b;
}

/** Legitimately separate events in one month (e.g. a supplementary rendimento) are summed. */
export function aggregateByMonth(events: readonly SelectedFnetEvent[]): Map<string, MonthlyFnetDistribution> {
  const out = new Map<string, MonthlyFnetDistribution>();
  for (const e of events) {
    const m = out.get(e.month) ?? {
      month: e.month,
      distributionPerShare: null,
      amortizationPerShare: null,
      baseDate: null,
      paymentDate: null,
      documentIds: [],
    };
    if (e.kind === "rendimento") {
      m.distributionPerShare = roundPerShare((m.distributionPerShare ?? 0) + e.valuePerShare);
      m.baseDate = laterDate(m.baseDate, e.baseDate);
      m.paymentDate = laterDate(m.paymentDate, e.paymentDate);
    } else {
      m.amortizationPerShare = roundPerShare((m.amortizationPerShare ?? 0) + e.valuePerShare);
    }
    if (!m.documentIds.includes(e.documentId)) m.documentIds.push(e.documentId);
    m.documentIds.sort((a, b) => a - b);
    out.set(e.month, m);
  }
  return out;
}

// ── Merge ─────────────────────────────────────────────────────────────────────

/**
 * `cvmRecords` carry NAV fields and, in cvmDerivedDistributionEstimate, the
 * CVM diagnostic estimate. The result has one record per month in
 * CVM months ∪ Fundos.Net months (from the first CVM month on):
 *   - monthlyDistributionPerShare is the Fundos.Net rendimento (an explicit 0
 *     included) or null — the CVM estimate is never used as a distribution;
 *   - a Fundos.Net month newer than the latest informe gets a record with null
 *     NAV fields (source "fii_fnet_only"); NAV is never invented.
 */
export function mergeDistributions(
  cvmRecords: readonly FiiFinancialRecord[],
  fnetByMonth: ReadonlyMap<string, MonthlyFnetDistribution>,
): FiiFinancialRecord[] {
  const cvmByMonth = new Map(
    cvmRecords.filter(r => r.source !== "fii_fnet_only").map(r => [r.referenceDate.slice(0, 7), r]),
  );
  if (cvmByMonth.size === 0) return [];
  const ticker = cvmRecords[0].ticker;
  const firstMonth = [...cvmByMonth.keys()].sort()[0];
  const months = [...new Set([...cvmByMonth.keys(), ...[...fnetByMonth.keys()].filter(m => m >= firstMonth)])].sort();

  return months.map((month): FiiFinancialRecord => {
    const cvm = cvmByMonth.get(month);
    const fnet = fnetByMonth.get(month);
    const fromFnet = fnet !== undefined && fnet.distributionPerShare !== null;
    return {
      ticker,
      referenceDate: cvm?.referenceDate ?? `${month}-01`,
      netAssetValue: cvm?.netAssetValue ?? null,
      quotaCount: cvm?.quotaCount ?? null,
      netAssetValuePerShare: cvm?.netAssetValuePerShare ?? null,
      monthlyDistributionPerShare: fromFnet ? fnet.distributionPerShare : null,
      distributionSource: fromFnet ? "fnet_structured" : null,
      distributionBaseDate: fromFnet ? fnet.baseDate : null,
      distributionPaymentDate: fromFnet ? fnet.paymentDate : null,
      fnetDocumentIds: fnet?.documentIds ?? [],
      monthlyAmortizationPerShare: fnet?.amortizationPerShare ?? null,
      cvmDerivedDistributionEstimate: cvm?.cvmDerivedDistributionEstimate ?? null,
      source: cvm ? cvm.source : "fii_fnet_only",
    };
  });
}

// ── Enrichment result ─────────────────────────────────────────────────────────

export interface FnetEnrichmentResult {
  records: FiiFinancialRecord[];
  enrichment: FiiDistributionEnrichment;
}

/**
 * A technical failure (an active notice that could not be downloaded or
 * parsed) means the notice set is incomplete. Data problems inside readable
 * notices — identity mismatches, unreadable periods — are not technical and
 * are reported as issues instead.
 */
export function fnetTechnicalFailure(notices: readonly FetchedFnetNotice[]): string | null {
  const broken = notices.filter(n => n.listing.status === "active" && n.notice === null);
  if (broken.length === 0) return null;
  return broken.map(n => `notice ${n.listing.id}: ${n.error ?? "not downloaded"}`).join("; ");
}

export function enrichWithFnet(
  identity: FiiFundIdentity,
  cvmRecords: readonly FiiFinancialRecord[],
  notices: readonly FetchedFnetNotice[],
): FnetEnrichmentResult {
  const { events, issues } = selectFundEvents(identity, notices);
  const merged = mergeDistributions(cvmRecords, aggregateByMonth(events));
  const used = new Set(merged.flatMap(r => r.fnetDocumentIds ?? []));
  return {
    records: merged,
    enrichment: {
      source: "fnet_structured",
      status: notices.length === 0 ? "no_events" : "ok",
      isin: identity.isin,
      noticesListed: notices.length,
      noticesUsed: used.size,
      issues,
    },
  };
}

/**
 * Fundos.Net unusable and no earlier Fundos.Net-backed cache to keep: NAV
 * data is written, every distribution is null, and the reason is recorded.
 */
export function fnetEnrichmentFailed(
  identity: FiiFundIdentity,
  cvmRecords: readonly FiiFinancialRecord[],
  reason: string,
): FnetEnrichmentResult {
  return {
    records: mergeDistributions(cvmRecords, new Map()),
    enrichment: {
      source: "fnet_structured",
      status: "failed",
      isin: identity.isin,
      noticesListed: 0,
      noticesUsed: 0,
      issues: [reason],
    },
  };
}

/** True when a committed cache already holds Fundos.Net-backed distributions. */
export function hasFnetDistributions(cache: FiiAnalysisResponse | null): boolean {
  return !!cache?.available && cache.records.some(r => r.distributionSource === "fnet_structured");
}

// ── Source comparison (diagnostics only, never used to merge) ─────────────────

// The CVM value is DY × NAV/share, so small differences are rounding.
export const DISTRIBUTION_MATCH_TOLERANCE = 0.005;    // ≤ 0.5 %: same amount
export const DISTRIBUTION_ROUNDING_TOLERANCE = 0.02;  // ≤ 2 %: rounding in the DY field

export type DistributionComparison = "match" | "rounding" | "material";

export function compareDistributionSources(fnet: number, cvm: number): DistributionComparison {
  if (fnet === 0) return cvm === 0 ? "match" : "material";
  const rel = Math.abs(cvm - fnet) / Math.abs(fnet);
  if (rel <= DISTRIBUTION_MATCH_TOLERANCE) return "match";
  if (rel <= DISTRIBUTION_ROUNDING_TOLERANCE) return "rounding";
  return "material";
}
