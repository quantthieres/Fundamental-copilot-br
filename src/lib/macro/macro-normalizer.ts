// Normalizes IMF WEO and BIS policy-rate responses into MacroIndicatorDataset.
//
// Pure functions only (no I/O). Output ordering is deterministic: countries by
// ISO-3, observations by year, aggregates by source code.
//
// No @/ imports — also used by tsx scripts.

import { MACRO_INDICATORS } from "./macro-indicators";
import { bisRefAreaToIso3, getMacroCountry, weoCountryToIso3 } from "./country-metadata";
import { EURO_AREA_ADOPTION, EURO_AREA_NAME_PT, EURO_AREA_REF_AREA } from "./euro-area";
import { latestActualKey, IMF_SDMX_BASE, type WeoParsedResponse } from "./weo-client";
import { BIS_SDMX_BASE, BIS_CBPOL_DATAFLOW, BIS_UNIT_PERCENT_PER_YEAR, type BisRawObservation } from "./bis-client";
import type {
  MacroAggregateSeries,
  MacroCountrySeries,
  MacroIndicatorDataset,
  MacroIndicatorId,
  MacroSourceMetadata,
  MacroStoredObservation,
  MacroStoredStatus,
} from "./macro-types";

type StoredStatus = MacroStoredStatus;
type Tuple = MacroStoredObservation;

export interface NormalizationIssues {
  /** Source codes that are neither a mapped country nor a known aggregate. */
  unmapped: string[];
  /** Observations dropped because the value was present but not a finite number. */
  invalidValues: string[];
  /** Identical duplicate observations collapsed into one. */
  duplicatesCollapsed: number;
  /** Conflicting duplicates (same country/period, different value) — fatal. */
  conflicts: string[];
  /** Other fatal problems (unexpected unit, frequency, …). */
  errors: string[];
}

function emptyIssues(): NormalizationIssues {
  return { unmapped: [], invalidValues: [], duplicatesCollapsed: 0, conflicts: [], errors: [] };
}

// ─── Values ──────────────────────────────────────────────────────────────────

const MISSING_TOKENS = new Set(["", "NaN", "NA", "n/a", "--", "..."]);

export type ParsedValue = { kind: "value"; value: number } | { kind: "missing" } | { kind: "invalid"; raw: string };

/** Strict numeric parse: missing markers → missing; anything non-finite → invalid. */
export function parseObservationValue(raw: string | undefined | null): ParsedValue {
  if (raw === undefined || raw === null) return { kind: "missing" };
  const s = raw.trim();
  if (MISSING_TOKENS.has(s)) return { kind: "missing" };
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return { kind: "invalid", raw };
  const v = Number(s);
  return Number.isFinite(v) ? { kind: "value", value: v } : { kind: "invalid", raw };
}

// ─── WEO status ──────────────────────────────────────────────────────────────

/**
 * Parses LATEST_ACTUAL_ANNUAL_DATA.
 *   "2025"       → 2025
 *   "FY2024/25"  → 2024 (conservative: the first calendar year the fiscal year
 *                  touches; WEO column placement of fiscal years differs by
 *                  country, so we never claim the later year as actual)
 *   "0", "", absent → null (no latest-actual information)
 * Anything else → null (and reported by the normalizer).
 */
export function parseLatestActualLabel(label: string | null | undefined): number | null {
  if (!label) return null;
  const s = label.trim();
  let m = /^(\d{4})$/.exec(s);
  if (m) return Number(m[1]) > 0 ? Number(m[1]) : null;
  m = /^FY(\d{4})\/\d{2}$/.exec(s);
  if (m) return Number(m[1]);
  return null;
}

/** LATEST_ACTUAL_ANNUAL_DATA values that explicitly mean "no actual data". */
function isEmptyLatestActualLabel(label: string): boolean {
  return /^0+$/.test(label.trim());
}

/**
 * WEO status rule (see WEO_STATUS_METHODOLOGY), per the IMF WEO FAQ: the
 * LATEST_ACTUAL_ANNUAL_DATA attribute marks the latest actual year, and the
 * years following it are IMF staff estimates.
 *   year <= latestActualYear → observed
 *   year >  latestActualYear → estimated
 *   latestActualYear null    → estimated (nothing claimed as actual)
 * "projected" is never emitted for WEO: the online database does not flag
 * projections per observation, and the IMF warns that the report's
 * forecast/shaded period need not match the series-level latest-actual year.
 * No edition year or clock is involved.
 */
export function classifyWeoStatus(year: number, latestActualYear: number | null): StoredStatus {
  return latestActualYear !== null && year <= latestActualYear ? "observed" : "estimated";
}

export const WEO_STATUS_METHODOLOGY =
  "observed: ano <= LATEST_ACTUAL_ANNUAL_DATA publicado pelo FMI para o par país×indicador " +
  "(rótulos de ano fiscal 'FY2024/25' contam como 2024, conservadoramente). " +
  "estimated: anos posteriores ao último dado efetivo — estimativas da equipe do FMI, conforme o FAQ do WEO; " +
  "sem LATEST_ACTUAL_ANNUAL_DATA (ausente ou zero), nenhum valor é tratado como efetivo. " +
  "projected não é usado para o WEO: o banco de dados não marca projeções por observação, e o período " +
  "de previsão do relatório não necessariamente coincide com o último dado efetivo de cada série. " +
  "A regra não usa o ano da edição nem a data atual.";

export const BIS_STATUS_METHODOLOGY =
  "observed: observação mensal publicada pelo BIS (valor de fim de mês). " +
  "Para cada ano usa-se a última observação mensal disponível naquele ano; referencePeriod indica o mês. " +
  "Membros da área do euro: série nacional do BIS antes do mês de adoção do euro; a partir dele, a taxa " +
  "da área do euro (BIS XM, política monetária do BCE), indicada em sourceArea = \"XM\". " +
  "Não há projeções de taxa básica. Áreas sem série BIS ficam sem dados (no_data).";

// ─── WEO vintage ─────────────────────────────────────────────────────────────

const MONTH_ABBR_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export interface WeoVintage {
  /** "2026-10" for the October 2026 WEO, "2026-04" for April. */
  vintage: string;
  /** "Oct/2026" style label (English month, as the IMF names editions). */
  label: string;
  year: number;
}

/**
 * Derives the WEO edition from the dataset PUBLICATION_DATE. The WEO is
 * published in April and in September/October; anything else is rejected so
 * that an unexpected release is reviewed by a human instead of mislabelled.
 */
export function deriveWeoVintage(publicationDate: string | null): WeoVintage {
  const m = publicationDate ? /^(\d{4})-(\d{2})-\d{2}/.exec(publicationDate) : null;
  if (!m) throw new Error(`Cannot derive WEO vintage from PUBLICATION_DATE "${publicationDate}"`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month === 4) return { vintage: `${year}-04`, label: `Apr/${year}`, year };
  if (month === 9 || month === 10) return { vintage: `${year}-10`, label: `Oct/${year}`, year };
  throw new Error(`Unexpected WEO publication month ${month} (${publicationDate}); expected April or September/October`);
}

/** "2026-09" → "Set/2026" */
export function formatMonthlyPeriodPt(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  return `${MONTH_ABBR_PT[Number(m[2]) - 1]}/${m[1]}`;
}

export const IMF_TERMS =
  "Dados do FMI sujeitos aos termos de uso do FMI (https://www.imf.org/external/terms.htm); citar a fonte.";
export const BIS_TERMS =
  "Dados do BIS sujeitos aos termos de uso do BIS (https://www.bis.org/terms_conditions.htm); citar a fonte.";

export function buildWeoSourceMetadata(parsed: WeoParsedResponse, vintage: WeoVintage): MacroSourceMetadata {
  return {
    id: "imf_weo",
    attribution: `IMF — World Economic Outlook, ${vintage.label}`,
    publisher: "IMF",
    datasetName: "World Economic Outlook (WEO)",
    dataflow: parsed.dataflow ?? "IMF.RES:WEO",
    endpoint: `${IMF_SDMX_BASE}/data/IMF.RES,WEO`,
    vintage: vintage.vintage,
    vintageLabel: vintage.label,
    publishedAt: parsed.publicationDate,
    terms: IMF_TERMS,
  };
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

function addObservation(
  byCountry: Map<string, Map<string, Tuple>>,
  key: string,
  tuple: Tuple,
  issues: NormalizationIssues,
  label: string,
): void {
  let periods = byCountry.get(key);
  if (!periods) byCountry.set(key, (periods = new Map()));
  const existing = periods.get(tuple[1]);
  if (!existing) {
    periods.set(tuple[1], tuple);
  } else if (existing[2] === tuple[2] && existing[3] === tuple[3]) {
    issues.duplicatesCollapsed++;
  } else {
    issues.conflicts.push(`${label} ${key} ${tuple[1]}: ${existing[2]} vs ${tuple[2]}`);
  }
}

function sortedTuples(periods: Map<string, Tuple>): Tuple[] {
  return [...periods.values()].sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
}

function computeAvailableYears(countries: MacroCountrySeries[]): number[] {
  const years = new Set<number>();
  for (const c of countries) for (const o of c.observations) years.add(o[0]);
  return [...years].sort((a, b) => a - b);
}

function computeLatestPeriod(countries: MacroCountrySeries[]): string {
  let latest = "";
  for (const c of countries) for (const o of c.observations) if (o[1] > latest) latest = o[1];
  return latest;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

// ─── WEO ─────────────────────────────────────────────────────────────────────

/** WEO aggregate codes (World G001, regions/groups G***, GX***) — not countries. */
export function isWeoAggregateCode(code: string): boolean {
  return /^G(X?\d{3})$/.test(code);
}

export interface WeoNormalizationResult {
  dataset: MacroIndicatorDataset;
  issues: NormalizationIssues;
}

export function normalizeWeoIndicator(
  parsed: WeoParsedResponse,
  indicator: MacroIndicatorId,
  options: { startYear: number; generatedAt: string },
): WeoNormalizationResult {
  const meta = MACRO_INDICATORS[indicator];
  if (meta.source !== "imf_weo") throw new Error(`${indicator} is not a WEO indicator`);
  const issues = emptyIssues();
  const vintage = deriveWeoVintage(parsed.publicationDate);

  const byCountry = new Map<string, Map<string, Tuple>>();
  const latestActual = new Map<string, { year: number | null; label: string | null }>();
  const unmapped: string[] = [];

  for (const s of parsed.series) {
    if (s.indicator !== meta.sourceCode) continue;
    if (s.frequency !== "A") {
      issues.errors.push(`${meta.sourceCode} ${s.country}: unexpected frequency ${s.frequency}`);
      continue;
    }
    const iso3 = weoCountryToIso3(s.country);
    if (!iso3) {
      if (!isWeoAggregateCode(s.country)) unmapped.push(s.country);
      continue;
    }
    const label = parsed.latestActual.get(latestActualKey(s.country, s.indicator)) ?? null;
    const laYear = parseLatestActualLabel(label);
    if (label !== null && laYear === null && label.trim() !== "" && !isEmptyLatestActualLabel(label)) {
      issues.errors.push(`${meta.sourceCode} ${s.country}: unrecognized LATEST_ACTUAL_ANNUAL_DATA "${label}"`);
    }
    latestActual.set(iso3, { year: laYear, label });

    for (const o of s.observations) {
      if (!/^\d{4}$/.test(o.period)) {
        issues.errors.push(`${meta.sourceCode} ${s.country}: unexpected annual period "${o.period}"`);
        continue;
      }
      const year = Number(o.period);
      if (year < options.startYear) continue;
      const v = parseObservationValue(o.value);
      if (v.kind === "missing") continue;
      if (v.kind === "invalid") {
        issues.invalidValues.push(`${meta.sourceCode} ${s.country} ${o.period}: "${v.raw}"`);
        continue;
      }
      const status = classifyWeoStatus(year, laYear);
      addObservation(byCountry, iso3, [year, o.period, v.value, status], issues, meta.sourceCode);
    }
  }

  const countries: MacroCountrySeries[] = [...byCountry.keys()].sort().map(iso3 => {
    const la = latestActual.get(iso3) ?? { year: null, label: null };
    return {
      iso3,
      latestActualYear: la.year,
      latestActualLabel: la.label,
      observations: sortedTuples(byCountry.get(iso3)!),
    };
  }).filter(c => c.observations.length > 0);

  issues.unmapped = uniqueSorted(unmapped);

  const dataset: MacroIndicatorDataset = {
    schemaVersion: 1,
    indicator: meta,
    source: buildWeoSourceMetadata(parsed, vintage),
    generatedAt: options.generatedAt,
    availableYears: computeAvailableYears(countries),
    latestReferencePeriod: computeLatestPeriod(countries),
    statusMethodology: WEO_STATUS_METHODOLOGY,
    countries,
    aggregates: [],
    unmappedSourceCodes: issues.unmapped,
  };
  return { dataset, issues };
}

// ─── BIS policy rates ────────────────────────────────────────────────────────

/** BIS aggregates that are intentionally not mapped to countries. */
export const BIS_AGGREGATE_NAMES: Readonly<Record<string, string>> = {
  [EURO_AREA_REF_AREA]: EURO_AREA_NAME_PT,
};

/** One monthly policy-rate value and the BIS REF_AREA that supplied it. */
export type MonthlyPolicyRate = readonly [period: string, value: number, sourceArea: string];

/**
 * For each calendar year, the last available monthly observation within that
 * year. Input periods must be "YYYY-MM". Months without a value must already
 * be filtered out. The latest year therefore resolves to the latest month.
 */
export function resolveLastMonthlyByYear(monthly: ReadonlyArray<MonthlyPolicyRate>): Tuple[] {
  const byYear = new Map<number, MonthlyPolicyRate>();
  for (const entry of monthly) {
    const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(entry[0]);
    if (!m) throw new Error(`Invalid monthly period "${entry[0]}"`);
    const year = Number(m[1]);
    const prev = byYear.get(year);
    if (!prev || entry[0] > prev[0]) byYear.set(year, entry);
  }
  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, [period, value, sourceArea]]) => [year, period, value, "observed", sourceArea]);
}

/**
 * Monthly policy rate that applies to a country:
 *   - non-member: its national BIS series only;
 *   - euro member: national series strictly before the adoption month, the
 *     euro-area series (XM) from the adoption month onward. National months at
 *     or after adoption and XM months before adoption are never used.
 */
export function combinePolicyRateSeries(
  iso3: string,
  national: ReadonlyArray<MonthlyPolicyRate>,
  euroArea: ReadonlyArray<MonthlyPolicyRate>,
): MonthlyPolicyRate[] {
  const adoption = EURO_AREA_ADOPTION[iso3];
  if (!adoption) return [...national];
  return [
    ...national.filter(m => m[0] < adoption),
    ...euroArea.filter(m => m[0] >= adoption),
  ].sort((a, b) => a[0].localeCompare(b[0]));
}

export function buildBisSourceMetadata(latestPeriod: string): MacroSourceMetadata {
  return {
    id: "bis_cbpol",
    attribution: "BIS — Central bank policy rates",
    publisher: "BIS",
    datasetName: "Central bank policy rates",
    dataflow: BIS_CBPOL_DATAFLOW,
    endpoint: `${BIS_SDMX_BASE}/data/dataflow/BIS/WS_CBPOL/1.0`,
    vintage: latestPeriod,
    vintageLabel: formatMonthlyPeriodPt(latestPeriod),
    publishedAt: null,
    terms: BIS_TERMS,
  };
}

export interface BisNormalizationResult {
  dataset: MacroIndicatorDataset;
  issues: NormalizationIssues;
}

export function normalizeBisPolicyRates(
  rows: readonly BisRawObservation[],
  options: { startYear: number; generatedAt: string },
): BisNormalizationResult {
  const meta = MACRO_INDICATORS.policy_rate;
  const issues = emptyIssues();
  // Keyed by BIS REF_AREA (countries and aggregates alike).
  const monthlyByArea = new Map<string, Map<string, Tuple>>();
  const unmapped: string[] = [];

  for (const r of rows) {
    if (r.freq !== "M") {
      issues.errors.push(`BIS ${r.refArea} ${r.period}: unexpected frequency ${r.freq}`);
      continue;
    }
    if (r.unitMeasure !== BIS_UNIT_PERCENT_PER_YEAR || r.unitMult !== "0") {
      issues.errors.push(`BIS ${r.refArea} ${r.period}: unexpected unit ${r.unitMeasure}×10^${r.unitMult}`);
      continue;
    }
    const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(r.period);
    if (!m) {
      issues.errors.push(`BIS ${r.refArea}: unexpected monthly period "${r.period}"`);
      continue;
    }
    if (Number(m[1]) < options.startYear) continue;
    const v = parseObservationValue(r.value);
    if (v.kind === "missing") continue;
    if (v.kind === "invalid") {
      issues.invalidValues.push(`BIS ${r.refArea} ${r.period}: "${v.raw}"`);
      continue;
    }
    if (!bisRefAreaToIso3(r.refArea) && !BIS_AGGREGATE_NAMES[r.refArea]) {
      unmapped.push(r.refArea);
      continue;
    }
    addObservation(monthlyByArea, r.refArea, [Number(m[1]), r.period, v.value, "observed"], issues, "BIS");
  }

  const monthlyOf = (area: string): MonthlyPolicyRate[] => {
    const periods = monthlyByArea.get(area);
    return periods ? sortedTuples(periods).map(t => [t[1], t[2], area] as const) : [];
  };
  const euroArea = monthlyOf(EURO_AREA_REF_AREA);

  const iso3s = new Set<string>(Object.keys(EURO_AREA_ADOPTION));
  for (const area of monthlyByArea.keys()) {
    const iso3 = bisRefAreaToIso3(area);
    if (iso3) iso3s.add(iso3);
  }

  const countries: MacroCountrySeries[] = [];
  for (const iso3 of [...iso3s].sort()) {
    const iso2 = getMacroCountry(iso3)?.iso2;
    const monthly = combinePolicyRateSeries(iso3, iso2 ? monthlyOf(iso2) : [], euroArea);
    if (monthly.length === 0) continue;
    const series: MacroCountrySeries = { iso3, observations: resolveLastMonthlyByYear(monthly) };
    const adoption = EURO_AREA_ADOPTION[iso3];
    if (adoption) series.euroAreaAdoption = adoption;
    countries.push(series);
  }

  const aggregates: MacroAggregateSeries[] = Object.keys(BIS_AGGREGATE_NAMES)
    .sort()
    .map(code => ({ sourceCode: code, name: BIS_AGGREGATE_NAMES[code], observations: resolveLastMonthlyByYear(monthlyOf(code)) }))
    .filter(a => a.observations.length > 0);

  issues.unmapped = uniqueSorted(unmapped);
  const latest = computeLatestPeriod(countries);

  const dataset: MacroIndicatorDataset = {
    schemaVersion: 1,
    indicator: meta,
    source: buildBisSourceMetadata(latest),
    generatedAt: options.generatedAt,
    availableYears: computeAvailableYears(countries),
    latestReferencePeriod: latest,
    statusMethodology: BIS_STATUS_METHODOLOGY,
    countries,
    aggregates,
    unmappedSourceCodes: issues.unmapped,
  };
  return { dataset, issues };
}
