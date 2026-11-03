// UI-side helpers for the Macro Map: formatting, year selection, policy-rate
// freshness, euro-area wording, ranking, search and URL state.
//
// These never re-derive observation statuses: status always comes from the
// API (MacroCountryValue.status). Pure functions, safe for client and server.

import { MACRO_INDICATOR_IDS, parseMacroIndicatorParam } from "./macro-indicators";
import { getRegionLabelPt, normalizeIso3 } from "./country-metadata";
import { EURO_AREA_REF_AREA } from "./euro-area";
import type {
  MacroCountryValue,
  MacroFrequency,
  MacroIndicatorId,
  MacroObservationStatus,
  MacroRegionId,
  MacroSourceId,
} from "./macro-types";

// ─── Number / period formatting (pt-BR) ──────────────────────────────────────

/** Decimals shown per indicator (raw API precision is kept internally). */
export const MACRO_DISPLAY_DECIMALS: Readonly<Record<MacroIndicatorId, number>> = {
  inflation: 2,
  policy_rate: 2,
  real_gdp_growth: 2,
  unemployment: 2,
  gov_debt_gdp: 1,
};

export function formatMacroNumber(value: number, decimals: number): string {
  const s = value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  // Avoid "-0,00" for tiny negatives and use a typographic minus.
  return (/^-0([,.]0+)?$/.test(s) ? s.slice(1) : s).replace("-", "−");
}

/**
 * "4,36%", "13,75%", "97,0% do PIB" (long form adds the unit qualifier for
 * debt and policy rate). null → "—".
 */
export function formatMacroValue(
  indicator: MacroIndicatorId,
  value: number | null,
  options: { long?: boolean } = {},
): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const n = `${formatMacroNumber(value, MACRO_DISPLAY_DECIMALS[indicator])}%`;
  return options.long ? `${n}${macroUnitSuffix(indicator)}` : n;
}

/** Unit qualifier shown after the number in long form (" a.a.", " do PIB"). */
export function macroUnitSuffix(indicator: MacroIndicatorId): string {
  if (indicator === "gov_debt_gdp") return " do PIB";
  if (indicator === "policy_rate") return " a.a.";
  return "";
}

const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-09" → "set/2026"; "2026" → "2026"; null → "—". */
export function formatReferencePeriod(period: string | null): string {
  if (!period) return "—";
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  return m ? `${MONTHS_PT[Number(m[2]) - 1]}/${m[1]}` : period;
}

/** Source vintage ("2026-10") → "Out/2026". Non-monthly strings pass through. */
export function formatVintagePt(vintage: string): string {
  const p = formatReferencePeriod(vintage);
  return p.charAt(0).toUpperCase() + p.slice(1);
}

export const MACRO_STATUS_LABELS: Readonly<Record<MacroObservationStatus, string>> = {
  observed: "Observado",
  estimated: "Estimativa",
  projected: "Projeção",
  no_data: "Sem dados",
};

// ─── Sources ─────────────────────────────────────────────────────────────────

export interface MacroSourceSummary {
  id: MacroSourceId;
  vintage: string;
}

/** Concise Portuguese attribution: "FMI — World Economic Outlook, Out/2026". */
export function formatSourceAttributionPt(source: MacroSourceSummary): string {
  if (source.id === "imf_weo") return `FMI — World Economic Outlook, ${formatVintagePt(source.vintage)}`;
  return "BIS — Central bank policy rates";
}

export function sourceShortLabelPt(source: MacroSourceId): string {
  return source === "imf_weo" ? "FMI · WEO" : "BIS";
}

// ─── Year selection ──────────────────────────────────────────────────────────

export interface ReferenceYearInput {
  frequency: MacroFrequency;
  source: MacroSourceSummary;
  latestReferencePeriod: string;
  available: boolean;
}

/**
 * Deterministic reference ("current") year for default selections, computed
 * on the server from the cached data — never from the visitor's clock:
 *   1. the IMF WEO edition year (vintage "2026-10" → 2026);
 *   2. otherwise the year of the latest monthly observation (BIS);
 *   3. otherwise `fallbackYear` (server-side, only when no cache is readable).
 */
export function resolveMacroReferenceYear(metas: readonly ReferenceYearInput[], fallbackYear: number): number {
  const weo = metas.find(m => m.available && m.source.id === "imf_weo" && /^\d{4}-\d{2}$/.test(m.source.vintage));
  if (weo) return Number(weo.source.vintage.slice(0, 4));
  const monthly = metas
    .filter(m => m.available && m.frequency === "monthly" && /^\d{4}-\d{2}$/.test(m.latestReferencePeriod))
    .map(m => Number(m.latestReferencePeriod.slice(0, 4)));
  return monthly.length > 0 ? Math.max(...monthly) : fallbackYear;
}

/**
 * Default year for an indicator, independent of how far estimates extend:
 * the reference year if available, otherwise the latest available year <=
 * reference year, otherwise the earliest available year. Future WEO years are
 * only shown when the user picks them (or passes them in the URL).
 */
export function chooseDefaultYear(availableYears: readonly number[], referenceYear: number): number | null {
  if (availableYears.length === 0) return null;
  if (availableYears.includes(referenceYear)) return referenceYear;
  const past = availableYears.filter(y => y <= referenceYear);
  return past.length > 0 ? Math.max(...past) : Math.min(...availableYears);
}

/**
 * Year to show after switching indicator: keep the selected year when the new
 * indicator supports it; otherwise the closest available year (ties resolve
 * to the earlier year, i.e. towards data that is more likely observed).
 */
export function resolveYearForIndicator(
  selectedYear: number | null,
  availableYears: readonly number[],
  referenceYear: number,
): number | null {
  if (selectedYear === null) return chooseDefaultYear(availableYears, referenceYear);
  if (availableYears.includes(selectedYear)) return selectedYear;
  let best: number | null = null;
  for (const y of availableYears) {
    if (best === null) { best = y; continue; }
    const d = Math.abs(y - selectedYear);
    const bd = Math.abs(best - selectedYear);
    if (d < bd || (d === bd && y < best)) best = y;
  }
  return best;
}

export function adjacentYear(availableYears: readonly number[], year: number, direction: -1 | 1): number | null {
  const sorted = [...availableYears].sort((a, b) => a - b);
  const i = sorted.indexOf(year);
  if (i < 0) return null;
  return sorted[i + direction] ?? null;
}

// ─── Policy-rate freshness (UI only; never changes the observed status) ──────

export type PolicyRateFreshness = "current" | "lagging" | "partial";

export interface PolicyRateFreshnessInfo {
  level: PolicyRateFreshness;
  /** Short note for tooltip/panel, null when nothing needs flagging. */
  note: string | null;
}

/**
 * How representative a monthly policy-rate reference is for the selected year.
 *
 * Historical years (before the dataset's latest year), by reference month:
 *   10–12 → current · 7–9 → lagging · 1–6 → partial
 * The dataset's latest year (still in progress), by months behind the latest
 * month available in the dataset:
 *   0–1 → current · 2–3 → lagging · ≥4 → partial
 *
 * Applies only to monthly series (policy rate); annual WEO values → null.
 */
export function classifyPolicyRateFreshness(
  frequency: MacroFrequency,
  referencePeriod: string | null,
  datasetLatestPeriod: string,
): PolicyRateFreshnessInfo | null {
  if (frequency !== "monthly" || !referencePeriod) return null;
  const ref = /^(\d{4})-(\d{2})$/.exec(referencePeriod);
  const latest = /^(\d{4})-(\d{2})$/.exec(datasetLatestPeriod);
  if (!ref || !latest) return null;
  const year = Number(ref[1]);
  const month = Number(ref[2]);
  const latestYear = Number(latest[1]);

  if (year < latestYear) {
    if (month >= 10) return { level: "current", note: null };
    if (month >= 7) return { level: "lagging", note: "Referência anterior ao fim do ano" };
    return { level: "partial", note: "Dado parcial no ano" };
  }
  const lag = (latestYear - year) * 12 + Number(latest[2]) - month;
  if (lag <= 1) return { level: "current", note: null };
  if (lag <= 3) return { level: "lagging", note: "Referência anterior ao mês mais recente" };
  return { level: "partial", note: "Dado parcial no ano" };
}

// ─── Euro-area wording ───────────────────────────────────────────────────────

export const EURO_AREA_POLICY_RATE_LABEL = "Taxa da área do euro (BCE)";

/** Label shown when a member's policy rate comes from the euro-area series. */
export function policyRateSourceLabel(value: Pick<MacroCountryValue, "sourceArea" | "sourceAreaName">): string | null {
  if (value.sourceArea === EURO_AREA_REF_AREA || /área do euro/i.test(value.sourceAreaName ?? "")) {
    return EURO_AREA_POLICY_RATE_LABEL;
  }
  return null;
}

// ─── Ranking ─────────────────────────────────────────────────────────────────

export type RankingOrder = "desc" | "asc";

export interface RankingRow extends MacroCountryValue {
  rank: number;
}

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

/**
 * Countries with a value, sorted by value ("desc" = numerically higher first),
 * tie-break by Portuguese country name (then ISO-3), optionally filtered by
 * region and truncated to `limit`. no_data rows are always excluded.
 */
export function buildRanking(
  countries: readonly MacroCountryValue[],
  options: { order: RankingOrder; region?: MacroRegionId | "all"; limit?: number | null },
): RankingRow[] {
  const sign = options.order === "desc" ? -1 : 1;
  const rows = countries
    .filter(c => c.status !== "no_data" && c.value !== null && Number.isFinite(c.value))
    .filter(c => !options.region || options.region === "all" || c.region === options.region)
    .sort((a, b) =>
      sign * ((a.value as number) - (b.value as number))
      || collator.compare(a.countryName, b.countryName)
      || a.iso3.localeCompare(b.iso3))
    .map((c, i) => ({ ...c, rank: i + 1 }));
  return options.limit ? rows.slice(0, options.limit) : rows;
}

// ─── Search ──────────────────────────────────────────────────────────────────

/** Lowercase, strip accents and collapse whitespace. */
export function normalizeSearchText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export interface SearchableCountry {
  iso3: string;
  countryName: string;
}

/**
 * Partial match on the display name (accent/case-insensitive); prefix and
 * word-start matches rank first. Also accepts an exact ISO-3 code.
 */
export function searchCountries<T extends SearchableCountry>(countries: readonly T[], query: string, limit = 8): T[] {
  const q = normalizeSearchText(query);
  if (!q) return [];
  const scored: Array<{ c: T; score: number }> = [];
  for (const c of countries) {
    const name = normalizeSearchText(c.countryName);
    let score = -1;
    if (name.startsWith(q)) score = 0;
    else if (name.split(" ").some(w => w.startsWith(q))) score = 1;
    else if (name.includes(q)) score = 2;
    else if (q.length === 3 && c.iso3.toLowerCase() === q) score = 3;
    if (score >= 0) scored.push({ c, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || collator.compare(a.c.countryName, b.c.countryName))
    .slice(0, limit)
    .map(s => s.c);
}

// ─── Region label ────────────────────────────────────────────────────────────

export function regionLabel(region: MacroRegionId): string {
  return getRegionLabelPt(region);
}

// ─── URL state ───────────────────────────────────────────────────────────────

export interface MacroUrlState {
  indicator: MacroIndicatorId;
  year: number | null;
  country: string | null;
}

/** Parses ?indicator=&year=&country=; invalid values fall back silently. */
export function parseMacroUrlState(params: { get(name: string): string | null }): MacroUrlState {
  const indicator = parseMacroIndicatorParam(params.get("indicator") ?? "") ?? MACRO_INDICATOR_IDS[0];
  const rawYear = params.get("year");
  const year = rawYear && /^\d{4}$/.test(rawYear.trim()) ? Number(rawYear.trim()) : null;
  const rawCountry = params.get("country");
  const country = rawCountry ? normalizeIso3(rawCountry) : null;
  return { indicator, year, country };
}

/**
 * Initial page state: an explicit, valid `?year=` for the indicator is kept
 * as-is (including future WEO years); otherwise the default-year rule applies.
 */
export function resolveInitialMacroState(
  url: MacroUrlState,
  availableYearsByIndicator: Readonly<Record<MacroIndicatorId, readonly number[]>>,
  referenceYear: number,
): MacroUrlState {
  const years = availableYearsByIndicator[url.indicator] ?? [];
  const year = url.year !== null && years.includes(url.year) ? url.year : chooseDefaultYear(years, referenceYear);
  return { indicator: url.indicator, year, country: url.country };
}

export function buildMacroQueryString(state: MacroUrlState): string {
  const p = new URLSearchParams();
  p.set("indicator", state.indicator);
  if (state.year !== null) p.set("year", String(state.year));
  if (state.country) p.set("country", state.country);
  return p.toString();
}

// ─── Presentation (tooltip + country panel) ──────────────────────────────────

export interface MacroValueInput {
  indicator: MacroIndicatorId;
  frequency: MacroFrequency;
  value: number | null;
  status: MacroObservationStatus;
  referencePeriod: string | null;
  sourceArea: string | null;
  sourceAreaName: string | null;
}

export interface MacroValuePresentation {
  valueText: string;
  valueLongText: string;
  statusLabel: string;
  /** "Ref.: set/2026" for monthly data, "2026" for annual, null for no_data. */
  referenceText: string | null;
  /** "Taxa da área do euro (BCE)" when the euro-area series applies. */
  sourceAreaLabel: string | null;
  freshness: PolicyRateFreshnessInfo | null;
}

/**
 * Formats one value for display. Uses the API status as-is; adds the monthly
 * reference period, euro-area wording and policy-rate freshness note.
 */
export function presentMacroValue(input: MacroValueInput, datasetLatestPeriod: string): MacroValuePresentation {
  const noData = input.status === "no_data" || input.value === null;
  return {
    valueText: formatMacroValue(input.indicator, noData ? null : input.value),
    valueLongText: formatMacroValue(input.indicator, noData ? null : input.value, { long: true }),
    statusLabel: MACRO_STATUS_LABELS[noData ? "no_data" : input.status],
    referenceText: noData || !input.referencePeriod
      ? null
      : input.frequency === "monthly"
        ? `Ref.: ${formatReferencePeriod(input.referencePeriod)}`
        : input.referencePeriod,
    sourceAreaLabel: noData ? null : policyRateSourceLabel(input),
    freshness: noData ? null : classifyPolicyRateFreshness(input.frequency, input.referencePeriod, datasetLatestPeriod),
  };
}
