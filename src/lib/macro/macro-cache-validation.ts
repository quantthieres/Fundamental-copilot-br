// Structural validation and regression guard for normalized macro caches.
//
// validateMacroDataset   — the dataset is well-formed on its own.
// compareMacroDatasets   — replacing `previous` with `next` is not an obvious
//                          regression. With no previous file (first
//                          generation) only validateMacroDataset applies.
//
// No @/ imports — also used by tsx scripts.

import { getMacroCountry, isIso3Format, isKnownIso3 } from "./country-metadata";
import { EURO_AREA_REF_AREA, usesEuroAreaRate } from "./euro-area";
import { MACRO_INDICATORS, isMacroIndicatorId } from "./macro-indicators";
import type { MacroIndicatorDataset } from "./macro-types";

const STORED_STATUSES = new Set(["observed", "estimated", "projected"]);

/** Regression thresholds (fractions of the previous cache). */
export const MACRO_GUARD_LIMITS = {
  minCountryRatio: 0.9,
  minYearRatio: 0.8,
  minObservationRatio: 0.8,
} as const;

export function countObservations(ds: MacroIndicatorDataset): number {
  return ds.countries.reduce((n, c) => n + c.observations.length, 0);
}

export function validateMacroDataset(ds: MacroIndicatorDataset): string[] {
  const errors: string[] = [];
  const id = ds?.indicator?.id;
  if (ds?.schemaVersion !== 1) errors.push("schemaVersion must be 1");
  if (!id || !isMacroIndicatorId(id)) return [...errors, `unknown indicator "${id}"`];
  const meta = MACRO_INDICATORS[id];
  if (ds.indicator.source !== meta.source || ds.indicator.sourceCode !== meta.sourceCode) {
    errors.push(`${id}: indicator metadata does not match the registry`);
  }
  if (ds.source?.id !== meta.source) errors.push(`${id}: source ${ds.source?.id} != ${meta.source}`);
  if (!ds.source?.vintage) errors.push(`${id}: missing source vintage`);
  if (!ds.generatedAt || Number.isNaN(Date.parse(ds.generatedAt))) errors.push(`${id}: invalid generatedAt`);
  if (!Array.isArray(ds.countries) || ds.countries.length === 0) {
    errors.push(`${id}: no countries`);
    return errors;
  }

  const seenCountries = new Set<string>();
  const years = new Set<number>();
  let latest = "";
  let previousIso = "";
  for (const c of ds.countries) {
    if (!isIso3Format(c.iso3)) errors.push(`${id}: malformed ISO-3 "${c.iso3}"`);
    else if (!isKnownIso3(c.iso3)) errors.push(`${id}: unknown ISO-3 "${c.iso3}"`);
    if (seenCountries.has(c.iso3)) errors.push(`${id}: duplicate country ${c.iso3}`);
    if (c.iso3 < previousIso) errors.push(`${id}: countries not sorted at ${c.iso3}`);
    previousIso = c.iso3;
    seenCountries.add(c.iso3);

    const seenYears = new Set<number>();
    let previousYear = -Infinity;
    for (const o of c.observations) {
      const [year, period, value, status] = o;
      if (!Number.isInteger(year)) errors.push(`${id} ${c.iso3}: invalid year ${year}`);
      if (seenYears.has(year)) errors.push(`${id} ${c.iso3}: duplicate year ${year}`);
      if (year < previousYear) errors.push(`${id} ${c.iso3}: observations not sorted at ${year}`);
      if (typeof value !== "number" || !Number.isFinite(value)) errors.push(`${id} ${c.iso3} ${year}: non-finite value`);
      if (!STORED_STATUSES.has(status)) errors.push(`${id} ${c.iso3} ${year}: invalid status ${status}`);
      const periodOk = meta.frequency === "annual"
        ? period === String(year)
        : new RegExp(`^${year}-(0[1-9]|1[0-2])$`).test(period);
      if (!periodOk) errors.push(`${id} ${c.iso3} ${year}: period "${period}" does not match ${meta.frequency} frequency`);
      if (meta.frequency === "monthly" && status !== "observed") errors.push(`${id} ${c.iso3} ${year}: monthly data must be observed`);
      if (meta.source === "bis_cbpol") {
        const area = o[4];
        const ownIso2 = getMacroCountry(c.iso3)?.iso2;
        if (area === EURO_AREA_REF_AREA) {
          if (!usesEuroAreaRate(c.iso3, period)) {
            errors.push(`${id} ${c.iso3} ${period}: euro-area rate applied outside euro membership`);
          }
        } else if (area !== ownIso2) {
          errors.push(`${id} ${c.iso3} ${period}: unexpected source area "${area}"`);
        } else if (usesEuroAreaRate(c.iso3, period)) {
          errors.push(`${id} ${c.iso3} ${period}: national rate used after euro adoption`);
        }
      } else if (o.length > 4) {
        errors.push(`${id} ${c.iso3} ${year}: sourceArea is only valid for BIS data`);
      }
      seenYears.add(year);
      previousYear = year;
      years.add(year);
      if (period > latest) latest = period;
    }
  }

  if (countObservations(ds) === 0) errors.push(`${id}: all values are null`);
  const expectedYears = [...years].sort((a, b) => a - b);
  if (JSON.stringify(expectedYears) !== JSON.stringify(ds.availableYears)) {
    errors.push(`${id}: availableYears does not match observations`);
  }
  if (ds.latestReferencePeriod !== latest) {
    errors.push(`${id}: latestReferencePeriod ${ds.latestReferencePeriod} != ${latest}`);
  }
  return errors;
}

function span(years: number[]): number {
  return years.length === 0 ? 0 : years[years.length - 1] - years[0] + 1;
}

export function compareMacroDatasets(previous: MacroIndicatorDataset | null, next: MacroIndicatorDataset): string[] {
  if (!previous) return [];
  const id = next.indicator.id;
  const errors: string[] = [];
  const L = MACRO_GUARD_LIMITS;

  if (previous.indicator.id !== id) errors.push(`${id}: previous cache is for ${previous.indicator.id}`);
  if (previous.source.id !== next.source.id) errors.push(`${id}: source changed ${previous.source.id} → ${next.source.id}`);
  // Both sources use "YYYY-MM" vintages, so string order is chronological.
  if (next.source.vintage < previous.source.vintage) {
    errors.push(`${id}: source vintage moved backward ${previous.source.vintage} → ${next.source.vintage}`);
  }
  if (next.countries.length < previous.countries.length * L.minCountryRatio) {
    errors.push(`${id}: country coverage collapsed ${previous.countries.length} → ${next.countries.length}`);
  }
  if (span(next.availableYears) < span(previous.availableYears) * L.minYearRatio) {
    errors.push(`${id}: year range shrank ${previous.availableYears[0]}–${previous.availableYears.at(-1)} → ` +
      `${next.availableYears[0]}–${next.availableYears.at(-1)}`);
  }
  if (countObservations(next) < countObservations(previous) * L.minObservationRatio) {
    errors.push(`${id}: observations dropped ${countObservations(previous)} → ${countObservations(next)}`);
  }
  if (next.latestReferencePeriod < previous.latestReferencePeriod) {
    errors.push(`${id}: latest period moved backward ${previous.latestReferencePeriod} → ${next.latestReferencePeriod}`);
  }
  return errors;
}

/**
 * Deterministic serialization: header fields pretty-printed, one line per
 * country/aggregate so diffs stay readable and files compact.
 */
export function serializeMacroDataset(ds: MacroIndicatorDataset): string {
  const { countries, aggregates, ...header } = ds;
  const head = JSON.stringify(header, null, 2).replace(/\n}$/, "");
  const lines = (items: unknown[]) =>
    items.length === 0 ? "[]" : `[\n${items.map(i => `    ${JSON.stringify(i)}`).join(",\n")}\n  ]`;
  return `${head},\n  "countries": ${lines(countries)},\n  "aggregates": ${lines(aggregates)}\n}\n`;
}

/** True when two datasets differ only in generatedAt. */
export function isSameDataIgnoringGeneratedAt(a: MacroIndicatorDataset, b: MacroIndicatorDataset): boolean {
  return serializeMacroDataset({ ...a, generatedAt: "" }) === serializeMacroDataset({ ...b, generatedAt: "" });
}
