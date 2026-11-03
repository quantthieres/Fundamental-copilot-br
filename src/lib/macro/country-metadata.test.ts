import { describe, it, expect } from "vitest";
import {
  MACRO_COUNTRIES,
  WEO_COUNTRY_CODE_OVERRIDES,
  bisRefAreaToIso3,
  getMacroCountry,
  isIso3Format,
  isKnownIso3,
  normalizeIso3,
  weoCountryToIso3,
} from "./country-metadata";

const KNOWN: Array<[iso3: string, iso2: string, region: string]> = [
  ["BRA", "BR", "latin_america"],
  ["USA", "US", "north_america"],
  ["GBR", "GB", "europe"],
  ["DEU", "DE", "europe"],
  ["JPN", "JP", "asia"],
  ["CHN", "CN", "asia"],
  ["IND", "IN", "asia"],
  ["ZAF", "ZA", "africa"],
  ["MEX", "MX", "latin_america"],
  ["ARG", "AR", "latin_america"],
];

describe("country metadata — known mappings", () => {
  it.each(KNOWN)("%s ↔ %s (%s)", (iso3, iso2, region) => {
    const c = getMacroCountry(iso3);
    expect(c).not.toBeNull();
    expect(c!.iso2).toBe(iso2);
    expect(c!.region).toBe(region);
    expect(c!.namePt.length).toBeGreaterThan(0);
    expect(bisRefAreaToIso3(iso2)).toBe(iso3);
    expect(weoCountryToIso3(iso3)).toBe(iso3);
  });

  it("has Portuguese display names", () => {
    expect(getMacroCountry("BRA")!.namePt).toBe("Brasil");
    expect(getMacroCountry("DEU")!.namePt).toBe("Alemanha");
    expect(getMacroCountry("GBR")!.namePt).toBe("Reino Unido");
  });
});

describe("country metadata — table integrity", () => {
  it("ISO-3 and ISO-2 codes are well-formed and unique", () => {
    const iso3 = MACRO_COUNTRIES.map(c => c.iso3);
    const iso2 = MACRO_COUNTRIES.map(c => c.iso2);
    for (const c of MACRO_COUNTRIES) {
      expect(c.iso3).toMatch(/^[A-Z]{3}$/);
      expect(c.iso2).toMatch(/^[A-Z]{2}$/);
    }
    expect(new Set(iso3).size).toBe(iso3.length);
    expect(new Set(iso2).size).toBe(iso2.length);
  });

  it("is sorted by ISO-3 (deterministic ordering)", () => {
    const iso3 = MACRO_COUNTRIES.map(c => c.iso3);
    expect(iso3).toEqual([...iso3].sort());
  });

  it("names are not reused as keys (unique display names)", () => {
    const names = MACRO_COUNTRIES.map(c => c.namePt);
    expect(new Set(names).size).toBe(names.length);
  });

  it("flags only Kosovo as a user-assigned code", () => {
    expect(MACRO_COUNTRIES.filter(c => c.userAssignedCode).map(c => c.iso3)).toEqual(["XKX"]);
  });
});

describe("ISO-3 validation", () => {
  it("checks format", () => {
    expect(isIso3Format("BRA")).toBe(true);
    expect(isIso3Format("bra")).toBe(false);
    expect(isIso3Format("BR")).toBe(false);
    expect(isIso3Format("BRAZ")).toBe(false);
    expect(isIso3Format("G001")).toBe(false);
    expect(isIso3Format("B1A")).toBe(false);
  });

  it("distinguishes well-formed from known", () => {
    expect(isKnownIso3("BRA")).toBe(true);
    expect(isKnownIso3("ZZZ")).toBe(false);
  });

  it("normalizes user input without fuzzy matching", () => {
    expect(normalizeIso3(" bra ")).toBe("BRA");
    expect(normalizeIso3("Brasil")).toBeNull();
    expect(normalizeIso3("BR")).toBeNull();
    expect(normalizeIso3("ZZZ")).toBeNull();
  });
});

describe("source identifier mapping", () => {
  it("maps the WEO non-ISO codes explicitly", () => {
    expect(WEO_COUNTRY_CODE_OVERRIDES).toEqual({ KOS: "XKX", WBG: "PSE" });
    expect(weoCountryToIso3("KOS")).toBe("XKX");
    expect(weoCountryToIso3("WBG")).toBe("PSE");
  });

  it("does not map WEO aggregates or unknown codes", () => {
    expect(weoCountryToIso3("G001")).toBeNull();
    expect(weoCountryToIso3("GX123")).toBeNull();
    expect(weoCountryToIso3("WHD")).toBeNull();
  });

  it("does not map BIS aggregates (euro area) or unknown areas to a country", () => {
    expect(bisRefAreaToIso3("XM")).toBeNull();
    expect(bisRefAreaToIso3("1X")).toBeNull();
    expect(bisRefAreaToIso3("br")).toBeNull();
  });

  it("maps BIS areas whose ISO-2 differs from a naive ISO-3 prefix", () => {
    expect(bisRefAreaToIso3("RS")).toBe("SRB");
    expect(bisRefAreaToIso3("MK")).toBe("MKD");
    expect(bisRefAreaToIso3("HK")).toBe("HKG");
    expect(bisRefAreaToIso3("KR")).toBe("KOR");
    expect(bisRefAreaToIso3("CH")).toBe("CHE");
  });
});
