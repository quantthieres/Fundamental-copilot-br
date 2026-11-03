import { describe, it, expect } from "vitest";
import {
  adjacentYear,
  buildMacroQueryString,
  buildRanking,
  chooseDefaultYear,
  classifyPolicyRateFreshness,
  formatMacroNumber,
  formatMacroValue,
  formatReferencePeriod,
  formatSourceAttributionPt,
  formatVintagePt,
  normalizeSearchText,
  parseMacroUrlState,
  policyRateSourceLabel,
  presentMacroValue,
  resolveInitialMacroState,
  resolveMacroReferenceYear,
  resolveYearForIndicator,
  searchCountries,
  EURO_AREA_POLICY_RATE_LABEL,
} from "./macro-ui";
import type { MacroCountryValue, MacroRegionId } from "./macro-types";

function cv(iso3: string, countryName: string, value: number | null, region: MacroRegionId = "europe",
  status: MacroCountryValue["status"] = value === null ? "no_data" : "observed"): MacroCountryValue {
  return { iso3, countryName, region, subregion: null, value, status, referencePeriod: value === null ? null : "2026", sourceArea: null, sourceAreaName: null };
}

describe("pt-BR formatting", () => {
  it("formats values with fixed decimals and units", () => {
    expect(formatMacroValue("inflation", 4.358831)).toBe("4,36%");
    expect(formatMacroValue("policy_rate", 13.75)).toBe("13,75%");
    expect(formatMacroValue("policy_rate", 2.5, { long: true })).toBe("2,50% a.a.");
    expect(formatMacroValue("gov_debt_gdp", 97.010193)).toBe("97,0%");
    expect(formatMacroValue("gov_debt_gdp", 97.010193, { long: true })).toBe("97,0% do PIB");
    expect(formatMacroValue("real_gdp_growth", -3.276691)).toBe("−3,28%");
    expect(formatMacroValue("inflation", 467.861)).toBe("467,86%");
    expect(formatMacroValue("inflation", 1234.5)).toBe("1.234,50%");
    expect(formatMacroValue("inflation", null)).toBe("—");
  });

  it("never renders a negative zero", () => {
    expect(formatMacroNumber(-0.001, 2)).toBe("0,00");
  });

  it("formats reference periods and vintages", () => {
    expect(formatReferencePeriod("2026-09")).toBe("set/2026");
    expect(formatReferencePeriod("2025-06")).toBe("jun/2025");
    expect(formatReferencePeriod("2026")).toBe("2026");
    expect(formatReferencePeriod(null)).toBe("—");
    expect(formatVintagePt("2026-10")).toBe("Out/2026");
  });

  it("builds Portuguese source attributions", () => {
    expect(formatSourceAttributionPt({ id: "imf_weo", vintage: "2026-10" })).toBe("FMI — World Economic Outlook, Out/2026");
    expect(formatSourceAttributionPt({ id: "bis_cbpol", vintage: "2026-09" })).toBe("BIS — Central bank policy rates");
  });
});

describe("year selection", () => {
  const weo = Array.from({ length: 32 }, (_, i) => 2000 + i); // 2000–2031
  const bis = Array.from({ length: 37 }, (_, i) => 1990 + i); // 1990–2026

  it("defaults to the current calendar year, not the last estimate year", () => {
    expect(chooseDefaultYear(weo, 2026)).toBe(2026);
    expect(chooseDefaultYear(bis, 2026)).toBe(2026);
  });

  it("falls back to the latest year <= current year, then to the earliest", () => {
    expect(chooseDefaultYear(bis, 2027)).toBe(2026);
    expect(chooseDefaultYear([2030, 2031], 2026)).toBe(2030);
    expect(chooseDefaultYear([], 2026)).toBeNull();
  });

  it("keeps the selected year when switching to an indicator that has it", () => {
    expect(resolveYearForIndicator(2031, weo, 2026)).toBe(2031);
    expect(resolveYearForIndicator(2010, bis, 2026)).toBe(2010);
  });

  it("switches to the closest available year when the new indicator lacks it", () => {
    expect(resolveYearForIndicator(2031, bis, 2026)).toBe(2026); // WEO 2031 → policy rate
    expect(resolveYearForIndicator(1995, weo, 2026)).toBe(2000); // policy 1995 → WEO
    expect(resolveYearForIndicator(2002, [2000, 2004], 2026)).toBe(2000); // tie → earlier
    expect(resolveYearForIndicator(null, weo, 2026)).toBe(2026);
  });

  it("steps to adjacent available years", () => {
    expect(adjacentYear(weo, 2026, -1)).toBe(2025);
    expect(adjacentYear(weo, 2031, 1)).toBeNull();
    expect(adjacentYear(weo, 1999, 1)).toBeNull();
  });
});

describe("policy-rate freshness (UI only)", () => {
  const LATEST = "2026-09";

  it("historical years: Q4 normal, Q3 lagging, H1 partial", () => {
    expect(classifyPolicyRateFreshness("monthly", "2025-12", LATEST)?.level).toBe("current");
    expect(classifyPolicyRateFreshness("monthly", "2025-10", LATEST)?.level).toBe("current");
    expect(classifyPolicyRateFreshness("monthly", "2022-07", LATEST)).toEqual({ level: "lagging", note: "Referência anterior ao fim do ano" });
    expect(classifyPolicyRateFreshness("monthly", "2025-06", LATEST)).toEqual({ level: "partial", note: "Dado parcial no ano" });
  });

  it("latest year: measured against the latest month in the dataset", () => {
    expect(classifyPolicyRateFreshness("monthly", "2026-09", LATEST)?.level).toBe("current");
    expect(classifyPolicyRateFreshness("monthly", "2026-08", LATEST)?.level).toBe("current");
    expect(classifyPolicyRateFreshness("monthly", "2026-06", LATEST)?.level).toBe("lagging");
    expect(classifyPolicyRateFreshness("monthly", "2026-03", LATEST)?.level).toBe("partial");
  });

  it("does not apply to annual WEO observations or missing periods", () => {
    expect(classifyPolicyRateFreshness("annual", "2025", "2031")).toBeNull();
    expect(classifyPolicyRateFreshness("monthly", null, LATEST)).toBeNull();
  });

  it("never changes the status: a stale BIS value is still observed", () => {
    const p = presentMacroValue({
      indicator: "policy_rate", frequency: "monthly", value: 29, status: "observed",
      referencePeriod: "2025-06", sourceArea: "AR", sourceAreaName: null,
    }, LATEST);
    expect(p.statusLabel).toBe("Observado");
    expect(p.referenceText).toBe("Ref.: jun/2025");
    expect(p.freshness?.level).toBe("partial");
  });
});

describe("euro-area policy-rate wording", () => {
  it("labels XM-sourced rates as the euro-area (ECB) rate", () => {
    expect(policyRateSourceLabel({ sourceArea: "XM", sourceAreaName: "Área do euro (BCE)" })).toBe(EURO_AREA_POLICY_RATE_LABEL);
    expect(EURO_AREA_POLICY_RATE_LABEL).toBe("Taxa da área do euro (BCE)");
    expect(policyRateSourceLabel({ sourceArea: "PL", sourceAreaName: null })).toBeNull();
    expect(policyRateSourceLabel({ sourceArea: null, sourceAreaName: null })).toBeNull();
  });

  it("presents a euro member with its own name and the ECB label", () => {
    const p = presentMacroValue({
      indicator: "policy_rate", frequency: "monthly", value: 2.5, status: "observed",
      referencePeriod: "2026-09", sourceArea: "XM", sourceAreaName: "Área do euro (BCE)",
    }, "2026-09");
    expect(p).toMatchObject({
      valueText: "2,50%", valueLongText: "2,50% a.a.", statusLabel: "Observado",
      referenceText: "Ref.: set/2026", sourceAreaLabel: "Taxa da área do euro (BCE)",
    });
  });

  it("WEO values show the year and their own status, without freshness", () => {
    const p = presentMacroValue({
      indicator: "inflation", frequency: "annual", value: 4.358831, status: "estimated",
      referencePeriod: "2026", sourceArea: null, sourceAreaName: null,
    }, "2031");
    expect(p).toMatchObject({ valueText: "4,36%", statusLabel: "Estimativa", referenceText: "2026", sourceAreaLabel: null, freshness: null });
  });

  it("no_data presents as Sem dados", () => {
    const p = presentMacroValue({
      indicator: "policy_rate", frequency: "monthly", value: null, status: "no_data",
      referencePeriod: null, sourceArea: null, sourceAreaName: null,
    }, "2026-09");
    expect(p).toMatchObject({ valueText: "—", statusLabel: "Sem dados", referenceText: null, freshness: null });
  });
});

describe("ranking", () => {
  const rows = [
    cv("DEU", "Alemanha", 2.5),
    cv("FRA", "França", 2.5),
    cv("BRA", "Brasil", 13.75, "latin_america"),
    cv("POL", "Polônia", 3.75),
    cv("USA", "Estados Unidos", 3.875, "north_america"),
    cv("TUV", "Tuvalu", null, "oceania"),
    cv("AUT", "Áustria", 2.5),
  ];

  it("sorts descending (Maior) and ascending (Menor)", () => {
    expect(buildRanking(rows, { order: "desc" }).map(r => r.iso3)).toEqual(["BRA", "USA", "POL", "DEU", "AUT", "FRA"]);
    expect(buildRanking(rows, { order: "asc" }).map(r => r.iso3)).toEqual(["DEU", "AUT", "FRA", "POL", "USA", "BRA"]);
  });

  it("breaks ties deterministically by Portuguese name (accent-insensitive)", () => {
    // Alemanha < Áustria < França in pt-BR collation, in both orders.
    const desc = buildRanking(rows, { order: "desc" }).filter(r => r.value === 2.5).map(r => r.countryName);
    const asc = buildRanking(rows, { order: "asc" }).filter(r => r.value === 2.5).map(r => r.countryName);
    expect(desc).toEqual(["Alemanha", "Áustria", "França"]);
    expect(asc).toEqual(desc);
  });

  it("excludes no_data and assigns ranks", () => {
    const r = buildRanking(rows, { order: "desc" });
    expect(r.some(x => x.iso3 === "TUV")).toBe(false);
    expect(r.map(x => x.rank)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("filters by region and limits to top N", () => {
    expect(buildRanking(rows, { order: "desc", region: "europe" }).map(r => r.iso3)).toEqual(["POL", "DEU", "AUT", "FRA"]);
    expect(buildRanking(rows, { order: "desc", region: "all", limit: 2 }).map(r => r.iso3)).toEqual(["BRA", "USA"]);
    expect(buildRanking(rows, { order: "desc", region: "africa" })).toEqual([]);
  });
});

describe("country search", () => {
  const list = [
    { iso3: "BRA", countryName: "Brasil" },
    { iso3: "AUT", countryName: "Áustria" },
    { iso3: "ZAF", countryName: "África do Sul" },
    { iso3: "SSD", countryName: "Sudão do Sul" },
    { iso3: "KOR", countryName: "Coreia do Sul" },
  ];

  it("normalizes case, accents and whitespace", () => {
    expect(normalizeSearchText("  ÁFRICA   do  Sul ")).toBe("africa do sul");
  });

  it("matches partial names, prefixes first", () => {
    expect(searchCountries(list, "austria").map(c => c.iso3)).toEqual(["AUT"]);
    expect(searchCountries(list, "BRA").map(c => c.iso3)).toEqual(["BRA"]);
    // All three are word-start matches → ordered by Portuguese name.
    expect(searchCountries(list, "sul").map(c => c.iso3)).toEqual(["ZAF", "KOR", "SSD"]);
    expect(searchCountries(list, "afr").map(c => c.iso3)).toEqual(["ZAF"]);
    expect(searchCountries(list, "  ")).toEqual([]);
    expect(searchCountries(list, "xyz")).toEqual([]);
  });
});

describe("URL state", () => {
  const params = (q: string) => new URLSearchParams(q);

  it("parses valid state", () => {
    expect(parseMacroUrlState(params("indicator=policy_rate&year=2025&country=deu")))
      .toEqual({ indicator: "policy_rate", year: 2025, country: "DEU" });
    expect(parseMacroUrlState(params("indicator=real-gdp-growth")).indicator).toBe("real_gdp_growth");
  });

  it("falls back on invalid values", () => {
    expect(parseMacroUrlState(params("indicator=nope&year=20x6&country=Brasil")))
      .toEqual({ indicator: "inflation", year: null, country: null });
    expect(parseMacroUrlState(params(""))).toEqual({ indicator: "inflation", year: null, country: null });
  });

  it("round-trips through the query string", () => {
    const s = { indicator: "gov_debt_gdp" as const, year: 2026, country: "BRA" };
    expect(buildMacroQueryString(s)).toBe("indicator=gov_debt_gdp&year=2026&country=BRA");
    expect(parseMacroUrlState(params(buildMacroQueryString(s)))).toEqual(s);
  });
});

describe("deterministic reference year (server-provided)", () => {
  const meta = (id: "imf_weo" | "bis_cbpol", vintage: string, frequency: "annual" | "monthly", latest: string, available = true) =>
    ({ source: { id, vintage }, frequency, latestReferencePeriod: latest, available });

  it("uses the WEO edition year, not any clock", () => {
    expect(resolveMacroReferenceYear([
      meta("imf_weo", "2026-10", "annual", "2031"),
      meta("bis_cbpol", "2026-09", "monthly", "2026-09"),
    ], 1999)).toBe(2026);
  });

  it("falls back to the latest monthly year, then to the given fallback", () => {
    expect(resolveMacroReferenceYear([
      meta("imf_weo", "", "annual", "", false),
      meta("bis_cbpol", "2026-09", "monthly", "2026-09"),
    ], 1999)).toBe(2026);
    expect(resolveMacroReferenceYear([], 2027)).toBe(2027);
  });
});

describe("initial page state", () => {
  const weo = Array.from({ length: 32 }, (_, i) => 2000 + i); // 2000–2031
  const years = { inflation: weo, policy_rate: [2024, 2025], real_gdp_growth: weo, unemployment: weo, gov_debt_gdp: weo };
  const noYear = { indicator: "inflation" as const, year: null, country: null };

  it("referenceYear=2026 selects 2026 when available", () => {
    expect(resolveInitialMacroState(noYear, years, 2026).year).toBe(2026);
  });

  it("referenceYear=2026 does not default to the last WEO estimate year (2031)", () => {
    expect(resolveInitialMacroState(noYear, years, 2026).year).not.toBe(2031);
    expect(chooseDefaultYear(weo, 2026)).toBe(2026);
  });

  it("when 2026 is unavailable, picks the latest year <= 2026", () => {
    expect(resolveInitialMacroState({ ...noYear, indicator: "policy_rate" }, years, 2026).year).toBe(2025);
  });

  it("keeps an explicit valid future year from the URL", () => {
    expect(resolveInitialMacroState({ ...noYear, year: 2031, country: "BRA" }, years, 2026))
      .toEqual({ indicator: "inflation", year: 2031, country: "BRA" });
  });

  it("replaces an explicit year the indicator does not have with the default", () => {
    expect(resolveInitialMacroState({ ...noYear, indicator: "policy_rate", year: 2031 }, years, 2026).year).toBe(2025);
  });
});
