// Typed contracts for the Macro Map data layer.
//
// Countries are always keyed by ISO 3166-1 alpha-3 (see country-metadata.ts).
// Values are never invented: a missing observation is { value: null,
// status: "no_data" }.
//
// No @/ imports — also used by tsx scripts.

export type MacroIndicatorId =
  | "inflation"
  | "policy_rate"
  | "real_gdp_growth"
  | "unemployment"
  | "gov_debt_gdp";

/**
 * - observed:  official historical data (WEO: year <= LATEST_ACTUAL_ANNUAL_DATA;
 *              BIS: published monthly observation)
 * - estimated: WEO value after the latest actual year (IMF staff estimate)
 * - projected: reserved for sources that flag projections per observation;
 *              not emitted for WEO (it does not publish that distinction)
 * - no_data:   no observation; value is always null
 *
 * See macro-normalizer.ts (classifyWeoStatus) for the exact WEO rule.
 */
export type MacroObservationStatus = "observed" | "estimated" | "projected" | "no_data";

export type MacroFrequency = "annual" | "monthly";

export type MacroSourceId = "imf_weo" | "bis_cbpol";

export type MacroRegionId =
  | "north_america"
  | "latin_america"
  | "europe"
  | "asia"
  | "africa"
  | "oceania";

export type MacroSubregionId =
  | "caribbean"
  | "central_america"
  | "south_america"
  | "middle_east"
  | "central_asia"
  | "east_asia"
  | "south_asia"
  | "southeast_asia"
  | "north_africa"
  | "sub_saharan_africa";

export interface MacroCountry {
  /** ISO 3166-1 alpha-3. The only key used for countries. */
  iso3: string;
  /** ISO 3166-1 alpha-2 (used to map BIS REF_AREA codes). */
  iso2: string;
  /** Portuguese display name. Never used as a key. */
  namePt: string;
  region: MacroRegionId;
  subregion?: MacroSubregionId;
  /**
   * True for codes outside the official ISO 3166-1 list but in the
   * user-assigned range (Kosovo: XKX / XK).
   */
  userAssignedCode?: true;
}

export interface MacroSourceMetadata {
  id: MacroSourceId;
  /** Short attribution, e.g. "IMF — World Economic Outlook, Oct/2026". */
  attribution: string;
  publisher: "IMF" | "BIS";
  datasetName: string;
  /** SDMX dataflow, e.g. "IMF.RES:WEO(9.0.0)". */
  dataflow: string;
  /** Official API endpoint family used by the precompute (no query). */
  endpoint: string;
  /**
   * Vintage/release identifier.
   * WEO: "2026-10" (publication year-month of the WEO release).
   * BIS: latest reference period in the dataset (the series is continuously
   *      updated and has no named vintage).
   */
  vintage: string;
  /** Human vintage label, e.g. "Oct/2026". */
  vintageLabel: string;
  /** Publication timestamp reported by the source, when available. */
  publishedAt: string | null;
  /** Licence/terms note to keep attribution compliant. */
  terms: string;
}

export interface MacroIndicatorMetadata {
  id: MacroIndicatorId;
  labelPt: string;
  unit: string;
  conceptPt: string;
  frequency: MacroFrequency;
  source: MacroSourceId;
  /** Source series code: WEO INDICATOR or BIS dataflow. */
  sourceCode: string;
  /** Cache file name (without directory). */
  cacheFile: string;
}

/** One stored observation for one country. */
export interface MacroObservation {
  indicator: MacroIndicatorId;
  iso3: string;
  /** Calendar year used by the year selector. */
  year: number;
  /** Source period: "2026" for WEO, "2026-09" for BIS monthly. */
  referencePeriod: string;
  frequency: MacroFrequency;
  value: number | null;
  unit: string;
  status: MacroObservationStatus;
}

export type MacroStoredStatus = Exclude<MacroObservationStatus, "no_data">;

/**
 * Compact stored observation: [year, referencePeriod, value, status, sourceArea?].
 * sourceArea is set for BIS policy rates only: the BIS REF_AREA actually used
 * ("BR", "FR", or "XM" when the euro-area rate applies to a member).
 */
export type MacroStoredObservation = [number, string, number, MacroStoredStatus, string?];

/** Per-country series as stored in the normalized cache file. */
export interface MacroCountrySeries {
  iso3: string;
  /**
   * WEO only: last year with actual (non-estimated) data, as published in
   * LATEST_ACTUAL_ANNUAL_DATA (raw label kept alongside). null = not published.
   */
  latestActualYear?: number | null;
  latestActualLabel?: string | null;
  /**
   * Policy rate only: first month ("YYYY-MM") in which the euro-area (ECB) rate
   * applies to this member. Absent for non-members.
   */
  euroAreaAdoption?: string;
  /** Sorted ascending by year; one entry per year with a non-null value. */
  observations: MacroStoredObservation[];
}

/** Non-country aggregates kept for reference (e.g. BIS XM = euro area). */
export interface MacroAggregateSeries {
  /** Source reference area (not an ISO-3 country), e.g. "XM". */
  sourceCode: string;
  name: string;
  observations: MacroStoredObservation[];
}

export interface MacroIndicatorDataset {
  schemaVersion: 1;
  indicator: MacroIndicatorMetadata;
  source: MacroSourceMetadata;
  generatedAt: string;
  /** Ascending years with at least one non-null value. */
  availableYears: number[];
  /** Latest source period with data, e.g. "2031" or "2026-09". */
  latestReferencePeriod: string;
  /** Explanation of how statuses were assigned for this indicator. */
  statusMethodology: string;
  countries: MacroCountrySeries[];
  aggregates: MacroAggregateSeries[];
  /** Source codes that could not be mapped to a country (reported, not dropped silently). */
  unmappedSourceCodes: string[];
}

/** UI-ready value of one indicator for one country in one selected year. */
export interface MacroCountryValue {
  iso3: string;
  countryName: string;
  region: MacroRegionId;
  subregion: MacroSubregionId | null;
  value: number | null;
  status: MacroObservationStatus;
  /** null when status is no_data. */
  referencePeriod: string | null;
  /**
   * BIS reference area that supplied the value (policy rate only), e.g. "BR"
   * or "XM". null for WEO indicators and for no_data.
   */
  sourceArea: string | null;
  /** Set when sourceArea is an aggregate, e.g. "Área do euro (BCE)". */
  sourceAreaName: string | null;
}

/** Response of GET /api/macro/[indicator]?year=YYYY */
export interface MacroIndicatorView {
  indicator: MacroIndicatorId;
  label: string;
  unit: string;
  frequency: MacroFrequency;
  selectedYear: number;
  source: string;
  sourceVintage: string;
  attribution: string;
  generatedAt: string;
  availableYears: number[];
  latestReferencePeriod: string;
  statusMethodology: string;
  countries: MacroCountryValue[];
}

export interface MacroSnapshotEntry {
  indicator: MacroIndicatorId;
  label: string;
  unit: string;
  frequency: MacroFrequency;
  value: number | null;
  status: MacroObservationStatus;
  referencePeriod: string | null;
  sourceArea: string | null;
  sourceAreaName: string | null;
  attribution: string;
  sourceVintage: string;
}

export interface MacroCountrySnapshot {
  iso3: string;
  countryName: string;
  region: MacroRegionId;
  selectedYear: number;
  indicators: MacroSnapshotEntry[];
}
