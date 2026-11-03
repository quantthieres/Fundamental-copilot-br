import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { parseWeoStructureSpecificXml } from "./weo-client";
import { parseBisPolicyRateCsv } from "./bis-client";
import { normalizeBisPolicyRates, normalizeWeoIndicator } from "./macro-normalizer";
import {
  compareMacroDatasets,
  isSameDataIgnoringGeneratedAt,
  serializeMacroDataset,
  validateMacroDataset,
} from "./macro-cache-validation";
import {
  buildMacroIndicatorView,
  defaultMacroYear,
  getMacroCountrySnapshot,
  getMacroIndicatorView,
  parseMacroDataset,
  parseMacroYearParam,
  readMacroDataset,
} from "./macro-cache";
import { MACRO_COUNTRIES } from "./country-metadata";
import { MACRO_INDICATOR_IDS, parseMacroIndicatorParam } from "./macro-indicators";
import type { MacroIndicatorDataset } from "./macro-types";
import { BIS_CSV_FIXTURE, WEO_XML_FIXTURE } from "./macro-test-fixtures";

const OPTS = { startYear: 2000, generatedAt: "2026-11-02T00:00:00.000Z" };

function inflation(): MacroIndicatorDataset {
  return normalizeWeoIndicator(parseWeoStructureSpecificXml(WEO_XML_FIXTURE), "inflation", OPTS).dataset;
}

function policyRate(): MacroIndicatorDataset {
  return normalizeBisPolicyRates(parseBisPolicyRateCsv(BIS_CSV_FIXTURE), OPTS).dataset;
}

const clone = (ds: MacroIndicatorDataset): MacroIndicatorDataset => JSON.parse(JSON.stringify(ds));

describe("validateMacroDataset", () => {
  it("accepts normalized datasets", () => {
    expect(validateMacroDataset(inflation())).toEqual([]);
    expect(validateMacroDataset(policyRate())).toEqual([]);
  });

  it("rejects malformed or unknown ISO codes", () => {
    const ds = clone(inflation());
    ds.countries[0].iso3 = "br";
    expect(validateMacroDataset(ds).some(e => /malformed ISO-3 "br"/.test(e))).toBe(true);
    ds.countries[0].iso3 = "AAA";
    expect(validateMacroDataset(ds).some(e => /unknown ISO-3 "AAA"/.test(e))).toBe(true);
  });

  it("rejects duplicate country/year observations and duplicate countries", () => {
    const ds = clone(inflation());
    ds.countries[0].observations.push([...ds.countries[0].observations.at(-1)!]);
    expect(validateMacroDataset(ds).some(e => /duplicate year/.test(e))).toBe(true);

    const ds2 = clone(inflation());
    ds2.countries.push(clone(inflation()).countries.at(-1)!);
    expect(validateMacroDataset(ds2).some(e => /duplicate country/.test(e))).toBe(true);
  });

  it("rejects datasets where every value is missing", () => {
    const ds = clone(inflation());
    for (const c of ds.countries) c.observations = [];
    ds.availableYears = [];
    ds.latestReferencePeriod = "";
    expect(validateMacroDataset(ds)).toContain("inflation: all values are null");
  });

  it("rejects non-finite values, bad statuses and period/frequency mismatches", () => {
    const ds = clone(policyRate());
    const bra = ds.countries.find(c => c.iso3 === "BRA")!;
    bra.observations[0] = [2024, "2024", 11, "observed", "BR"];
    bra.observations[1] = [2025, "2025-12", Number.NaN, "projected", "BR"];
    const errors = validateMacroDataset(ds);
    expect(errors.some(e => /does not match monthly frequency/.test(e))).toBe(true);
    expect(errors.some(e => /non-finite value/.test(e))).toBe(true);
    expect(errors.some(e => /monthly data must be observed/.test(e))).toBe(true);
  });

  it("rejects inconsistent availableYears and unsorted countries", () => {
    const ds = clone(inflation());
    ds.availableYears = [2025];
    ds.countries.reverse();
    const errors = validateMacroDataset(ds);
    expect(errors.some(e => /availableYears/.test(e))).toBe(true);
    expect(errors.some(e => /not sorted/.test(e))).toBe(true);
  });
});

describe("compareMacroDatasets (regression guard)", () => {
  it("allows initial creation and identical replacement", () => {
    expect(compareMacroDatasets(null, inflation())).toEqual([]);
    expect(compareMacroDatasets(inflation(), inflation())).toEqual([]);
  });

  it("rejects a vintage moving backward", () => {
    const next = clone(inflation());
    next.source.vintage = "2026-04";
    expect(compareMacroDatasets(inflation(), next)).toEqual([
      "inflation: source vintage moved backward 2026-10 → 2026-04",
    ]);
  });

  it("rejects collapsing coverage, shrinking years and dropped observations", () => {
    const next = clone(inflation());
    next.countries = next.countries.slice(0, 1);
    next.countries[0].observations = next.countries[0].observations.slice(0, 1);
    next.availableYears = [2024];
    next.latestReferencePeriod = "2024";
    const errors = compareMacroDatasets(inflation(), next);
    expect(errors.some(e => /country coverage collapsed 4 → 1/.test(e))).toBe(true);
    expect(errors.some(e => /year range shrank/.test(e))).toBe(true);
    expect(errors.some(e => /observations dropped/.test(e))).toBe(true);
    expect(errors.some(e => /latest period moved backward/.test(e))).toBe(true);
  });
});

describe("serialization", () => {
  it("is deterministic, round-trips and keeps one line per country", () => {
    const ds = inflation();
    const text = serializeMacroDataset(ds);
    expect(serializeMacroDataset(clone(ds))).toBe(text);
    expect(parseMacroDataset(text)).toEqual(ds);
    expect(text.split("\n").filter(l => l.startsWith('    {"iso3"'))).toHaveLength(ds.countries.length);
    expect(text.endsWith("}\n")).toBe(true);
  });

  it("detects generatedAt-only differences", () => {
    const a = inflation();
    const b = { ...clone(a), generatedAt: "2027-01-01T00:00:00.000Z" };
    expect(isSameDataIgnoringGeneratedAt(a, b)).toBe(true);
    b.countries[0].observations[0][2] = 99;
    expect(isSameDataIgnoringGeneratedAt(a, b)).toBe(false);
  });
});

describe("year and indicator parameters", () => {
  it("parses the year query", () => {
    expect(parseMacroYearParam(null)).toBeNull();
    expect(parseMacroYearParam("2026")).toBe(2026);
    expect(parseMacroYearParam("1990")).toBe(1990);
    for (const bad of ["", "abc", "26", "2026.5", "20260", "-2026", "1989", "2101", "2026 OR 1=1"]) {
      expect(parseMacroYearParam(bad)).toBe("invalid");
    }
  });

  it("accepts machine ids and kebab-case slugs only", () => {
    expect(parseMacroIndicatorParam("real-gdp-growth")).toBe("real_gdp_growth");
    expect(parseMacroIndicatorParam("POLICY_RATE")).toBe("policy_rate");
    expect(parseMacroIndicatorParam("../../etc/passwd")).toBeNull();
    expect(parseMacroIndicatorParam("gdp")).toBeNull();
  });

  it("defaults to the source vintage year, not the clock", () => {
    expect(defaultMacroYear(inflation())).toBe(2026);
    expect(defaultMacroYear(policyRate())).toBe(2026);
  });
});

describe("buildMacroIndicatorView", () => {
  it("lists every country, with no_data/null where there is no observation", () => {
    const view = buildMacroIndicatorView(policyRate(), 2025);
    expect(view.countries).toHaveLength(MACRO_COUNTRIES.length);
    expect(view.countries.map(c => c.iso3)).toEqual(MACRO_COUNTRIES.map(c => c.iso3));
    expect(view.countries.find(c => c.iso3 === "BRA")).toEqual({
      iso3: "BRA", countryName: "Brasil", region: "latin_america", subregion: "south_america",
      value: 12, status: "observed", referencePeriod: "2025-12", sourceArea: "BR", sourceAreaName: null,
    });
    expect(view.countries.find(c => c.iso3 === "DEU")).toMatchObject({ value: null, status: "no_data", referencePeriod: null });
    expect(view).toMatchObject({
      indicator: "policy_rate", label: "Taxa básica", unit: "% a.a.", selectedYear: 2025,
      sourceVintage: "2026-09", attribution: "BIS — Central bank policy rates",
    });
  });

  it("policy rate: selected year resolves to the last month of that year; current year to the latest month", () => {
    const ds = policyRate();
    expect(buildMacroIndicatorView(ds, 2024).countries.find(c => c.iso3 === "BRA")!.referencePeriod).toBe("2024-12");
    expect(buildMacroIndicatorView(ds, 2026).countries.find(c => c.iso3 === "BRA")).toMatchObject({
      value: 13, referencePeriod: "2026-09",
    });
    expect(buildMacroIndicatorView(ds, 2026).countries.find(c => c.iso3 === "USA")!.status).toBe("no_data");
  });

  it("policy rate: a euro member shows the ECB rate under its own ISO-3, labelled as the euro area", () => {
    const deu = buildMacroIndicatorView(policyRate(), 2026).countries.find(c => c.iso3 === "DEU")!;
    expect(deu).toMatchObject({
      iso3: "DEU", countryName: "Alemanha", value: 2, status: "observed", referencePeriod: "2026-09",
      sourceArea: "XM", sourceAreaName: "Área do euro (BCE)",
    });
    expect(buildMacroIndicatorView(policyRate(), 2026).countries.find(c => c.iso3 === "POL")!.status).toBe("no_data");
  });

  it("rejects XM applied outside membership or a national rate after adoption", () => {
    const ds = clone(policyRate());
    ds.countries.find(c => c.iso3 === "BRA")!.observations[2][4] = "XM";
    expect(validateMacroDataset(ds).some(e => /euro-area rate applied outside euro membership/.test(e))).toBe(true);
    const ds2 = clone(policyRate());
    ds2.countries.find(c => c.iso3 === "DEU")!.observations[0][4] = "DE";
    expect(validateMacroDataset(ds2).some(e => /national rate used after euro adoption/.test(e))).toBe(true);
  });

  it("WEO: exposes the stored status for the selected year", () => {
    const view = buildMacroIndicatorView(inflation(), 2026);
    expect(view.countries.find(c => c.iso3 === "BRA")).toMatchObject({
      value: 3.75, status: "estimated", referencePeriod: "2026", sourceArea: null, sourceAreaName: null,
    });
    expect(view.countries.find(c => c.iso3 === "IND")!.status).toBe("no_data");
  });
});

describe("cache reading and country snapshot", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "macro-cache-test-"));
    writeFileSync(join(dir, "inflation.json"), serializeMacroDataset(inflation()));
    writeFileSync(join(dir, "policy-rate.json"), serializeMacroDataset(policyRate()));
    writeFileSync(join(dir, "unemployment.json"), "{not json");
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("reads a cache and rejects missing, corrupt or mismatched files", () => {
    expect(readMacroDataset("inflation", dir)?.indicator.id).toBe("inflation");
    expect(readMacroDataset("unemployment", dir)).toBeNull();
    expect(readMacroDataset("gov_debt_gdp", dir)).toBeNull();
    writeFileSync(join(dir, "real-gdp-growth.json"), serializeMacroDataset(inflation()));
    expect(readMacroDataset("real_gdp_growth", dir)).toBeNull();
  });

  it("getMacroIndicatorView uses the default year when none is given", () => {
    expect(getMacroIndicatorView("inflation", null, dir)?.selectedYear).toBe(2026);
    expect(getMacroIndicatorView("unemployment", 2026, dir)).toBeNull();
  });

  it("returns all five indicators for one country/year", () => {
    const snap = getMacroCountrySnapshot("BRA", 2026, dir)!;
    expect(snap.countryName).toBe("Brasil");
    expect(snap.indicators.map(i => i.indicator)).toEqual([...MACRO_INDICATOR_IDS]);
    expect(snap.indicators.find(i => i.indicator === "inflation")).toMatchObject({
      value: 3.75, status: "estimated", referencePeriod: "2026", attribution: "IMF — World Economic Outlook, Oct/2026",
    });
    expect(snap.indicators.find(i => i.indicator === "policy_rate")).toMatchObject({ value: 13, referencePeriod: "2026-09", sourceArea: "BR" });
    // Missing caches are reported as no_data, never invented.
    expect(snap.indicators.find(i => i.indicator === "unemployment")).toMatchObject({ value: null, status: "no_data", attribution: "" });
    expect(getMacroCountrySnapshot("ZZZ", 2026, dir)).toBeNull();
  });
});
