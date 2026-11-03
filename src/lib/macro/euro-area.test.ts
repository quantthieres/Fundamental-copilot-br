import { describe, it, expect } from "vitest";
import { EURO_AREA_ADOPTION, getEuroAdoptionPeriod, usesEuroAreaRate } from "./euro-area";
import { isKnownIso3, getMacroCountry } from "./country-metadata";

describe("euro-area adoption mapping", () => {
  it("lists the 21 members with dated adoption (not all 1999)", () => {
    expect(Object.keys(EURO_AREA_ADOPTION)).toHaveLength(21);
    const founders = ["AUT", "BEL", "DEU", "ESP", "FIN", "FRA", "IRL", "ITA", "LUX", "NLD", "PRT"];
    for (const iso3 of founders) expect(EURO_AREA_ADOPTION[iso3], iso3).toBe("1999-01");
    expect(EURO_AREA_ADOPTION).toMatchObject({
      GRC: "2001-01", SVN: "2007-01", CYP: "2008-01", MLT: "2008-01", SVK: "2009-01",
      EST: "2011-01", LVA: "2014-01", LTU: "2015-01", HRV: "2023-01", BGR: "2026-01",
    });
  });

  it("uses known ISO-3 keys and January adoption months", () => {
    for (const [iso3, period] of Object.entries(EURO_AREA_ADOPTION)) {
      expect(isKnownIso3(iso3), iso3).toBe(true);
      expect(getMacroCountry(iso3)!.region).toBe("europe");
      expect(period).toMatch(/^\d{4}-01$/);
    }
  });

  it("switches exactly at the adoption month", () => {
    expect(usesEuroAreaRate("FRA", "1998-12")).toBe(false);
    expect(usesEuroAreaRate("FRA", "1999-01")).toBe(true);
    expect(usesEuroAreaRate("HRV", "2022-12")).toBe(false);
    expect(usesEuroAreaRate("HRV", "2023-01")).toBe(true);
  });

  it("never applies to non-members", () => {
    for (const iso3 of ["POL", "GBR", "DNK", "SWE", "HUN", "CZE", "ROU", "CHE", "BRA"]) {
      expect(getEuroAdoptionPeriod(iso3)).toBeNull();
      expect(usesEuroAreaRate(iso3, "2026-09")).toBe(false);
    }
  });
});
