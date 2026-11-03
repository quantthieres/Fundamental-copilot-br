// Server-side only. Reads the normalized macro caches written by
// scripts/precompute-macro-cache.ts and shapes them for the UI.
// Never calls IMF or BIS: request paths read static JSON only.

import { readFileSync } from "fs";
import { join } from "path";
import { MACRO_COUNTRIES, getMacroCountry } from "./country-metadata";
import { MACRO_INDICATORS, MACRO_INDICATOR_IDS, MACRO_START_YEAR } from "./macro-indicators";
import { BIS_AGGREGATE_NAMES } from "./macro-normalizer";
import type {
  MacroCountrySnapshot,
  MacroCountryValue,
  MacroIndicatorDataset,
  MacroIndicatorId,
  MacroIndicatorView,
  MacroObservationStatus,
} from "./macro-types";

export const MACRO_CACHE_DIR = join(process.cwd(), "src/data/macro-cache");

/** Upper bound for the year query parameter (sanity bound, not a data claim). */
export const MACRO_MAX_YEAR = 2100;

// Pure validator exported for testing.
export function parseMacroDataset(raw: string): MacroIndicatorDataset | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  if (obj.schemaVersion !== 1) return null;
  if (!Array.isArray(obj.countries) || !Array.isArray(obj.availableYears)) return null;
  const indicator = obj.indicator as { id?: unknown } | undefined;
  if (typeof indicator?.id !== "string") return null;
  return obj as unknown as MacroIndicatorDataset;
}

export function readMacroDataset(id: MacroIndicatorId, dir: string = MACRO_CACHE_DIR): MacroIndicatorDataset | null {
  try {
    const ds = parseMacroDataset(readFileSync(join(dir, MACRO_INDICATORS[id].cacheFile), "utf-8"));
    return ds && ds.indicator.id === id ? ds : null;
  } catch {
    return null;
  }
}

/**
 * Parses the `year` query parameter. Absent → null (caller uses the default
 * year). Returns "invalid" unless it is a 4-digit year within
 * [MACRO_START_YEAR, MACRO_MAX_YEAR].
 */
export function parseMacroYearParam(raw: string | null): number | null | "invalid" {
  if (raw === null) return null;
  const s = raw.trim();
  if (!/^\d{4}$/.test(s)) return "invalid";
  const year = Number(s);
  return year >= MACRO_START_YEAR && year <= MACRO_MAX_YEAR ? year : "invalid";
}

/**
 * Default year for a dataset: the source vintage year (WEO edition year, or
 * the year of the latest BIS month). Independent of the wall clock.
 */
export function defaultMacroYear(ds: MacroIndicatorDataset): number {
  const y = Number(ds.source.vintage.slice(0, 4));
  return Number.isInteger(y) ? y : ds.availableYears[ds.availableYears.length - 1];
}

interface ResolvedValue {
  value: number | null;
  status: MacroObservationStatus;
  referencePeriod: string | null;
  sourceArea: string | null;
  sourceAreaName: string | null;
}

const NO_DATA: ResolvedValue = { value: null, status: "no_data", referencePeriod: null, sourceArea: null, sourceAreaName: null };

function indexByCountry(ds: MacroIndicatorDataset, year: number): Map<string, ResolvedValue> {
  // Stored observations are already resolved per year (BIS: last month of the
  // year; WEO: the annual value), so lookup is by year only.
  const out = new Map<string, ResolvedValue>();
  for (const c of ds.countries) {
    const o = c.observations.find(t => t[0] === year);
    if (o) {
      const sourceArea = o[4] ?? null;
      out.set(c.iso3, {
        value: o[2],
        status: o[3],
        referencePeriod: o[1],
        sourceArea,
        sourceAreaName: sourceArea ? BIS_AGGREGATE_NAMES[sourceArea] ?? null : null,
      });
    }
  }
  return out;
}

/**
 * UI-ready view of one indicator for a year. Every country in the metadata
 * table is listed (ordered by ISO-3); countries without an observation get
 * status "no_data" and value null.
 */
export function buildMacroIndicatorView(ds: MacroIndicatorDataset, year: number): MacroIndicatorView {
  const values = indexByCountry(ds, year);
  const countries: MacroCountryValue[] = MACRO_COUNTRIES.map(c => {
    const v = values.get(c.iso3) ?? NO_DATA;
    return {
      iso3: c.iso3,
      countryName: c.namePt,
      region: c.region,
      subregion: c.subregion ?? null,
      value: v.value,
      status: v.status,
      referencePeriod: v.referencePeriod,
      sourceArea: v.sourceArea,
      sourceAreaName: v.sourceAreaName,
    };
  });
  return {
    indicator: ds.indicator.id,
    label: ds.indicator.labelPt,
    unit: ds.indicator.unit,
    frequency: ds.indicator.frequency,
    selectedYear: year,
    source: ds.source.datasetName,
    sourceVintage: ds.source.vintage,
    attribution: ds.source.attribution,
    generatedAt: ds.generatedAt,
    availableYears: ds.availableYears,
    latestReferencePeriod: ds.latestReferencePeriod,
    statusMethodology: ds.statusMethodology,
    countries,
  };
}

export function getMacroIndicatorView(
  id: MacroIndicatorId,
  year: number | null,
  dir: string = MACRO_CACHE_DIR,
): MacroIndicatorView | null {
  const ds = readMacroDataset(id, dir);
  if (!ds) return null;
  return buildMacroIndicatorView(ds, year ?? defaultMacroYear(ds));
}

/**
 * All five indicators for one country and year (selected-country panel).
 * Indicators whose cache is missing are reported as no_data with an empty
 * attribution rather than throwing. Returns null for an unknown country.
 */
export function getMacroCountrySnapshot(
  iso3: string,
  year: number,
  dir: string = MACRO_CACHE_DIR,
): MacroCountrySnapshot | null {
  const country = getMacroCountry(iso3);
  if (!country) return null;
  const indicators = MACRO_INDICATOR_IDS.map(id => {
    const meta = MACRO_INDICATORS[id];
    const ds = readMacroDataset(id, dir);
    const v = ds ? indexByCountry(ds, year).get(country.iso3) ?? NO_DATA : NO_DATA;
    return {
      indicator: id,
      label: meta.labelPt,
      unit: meta.unit,
      frequency: meta.frequency,
      value: v.value,
      status: v.status,
      referencePeriod: v.referencePeriod,
      sourceArea: v.sourceArea,
      sourceAreaName: v.sourceAreaName,
      attribution: ds?.source.attribution ?? "",
      sourceVintage: ds?.source.vintage ?? "",
    };
  });
  return { iso3: country.iso3, countryName: country.namePt, region: country.region, selectedYear: year, indicators };
}
