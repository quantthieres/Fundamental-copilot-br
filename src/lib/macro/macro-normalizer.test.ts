import { describe, it, expect } from "vitest";
import { parseWeoStructureSpecificXml, type WeoParsedResponse } from "./weo-client";
import { parseBisPolicyRateCsv, type BisRawObservation } from "./bis-client";
import {
  classifyWeoStatus,
  deriveWeoVintage,
  formatMonthlyPeriodPt,
  isWeoAggregateCode,
  normalizeBisPolicyRates,
  normalizeWeoIndicator,
  parseLatestActualLabel,
  parseObservationValue,
  resolveLastMonthlyByYear,
  combinePolicyRateSeries,
} from "./macro-normalizer";
import { BIS_CSV_FIXTURE, WEO_XML_FIXTURE } from "./macro-test-fixtures";

const OPTS = { startYear: 2000, generatedAt: "2026-11-02T00:00:00.000Z" };

function weo(): WeoParsedResponse {
  return parseWeoStructureSpecificXml(WEO_XML_FIXTURE);
}

function bisRow(refArea: string, period: string, value: string, extra: Partial<BisRawObservation> = {}): BisRawObservation {
  return { freq: "M", refArea, period, value, obsStatus: "A", unitMeasure: "368", unitMult: "0", ...extra };
}

describe("parseObservationValue", () => {
  it("parses finite numbers", () => {
    expect(parseObservationValue("1.25")).toEqual({ kind: "value", value: 1.25 });
    expect(parseObservationValue("-3")).toEqual({ kind: "value", value: -3 });
    expect(parseObservationValue(" 4 ")).toEqual({ kind: "value", value: 4 });
    expect(parseObservationValue("1e-2")).toEqual({ kind: "value", value: 0.01 });
  });

  it("treats missing markers as missing (never zero)", () => {
    for (const raw of [undefined, null, "", "NaN", "NA", "n/a", "--", "..."]) {
      expect(parseObservationValue(raw)).toEqual({ kind: "missing" });
    }
  });

  it("rejects non-numeric and non-finite values", () => {
    for (const raw of ["abc", "1,5", "Infinity", "1.2.3", "0x10", "12%"]) {
      expect(parseObservationValue(raw).kind).toBe("invalid");
    }
  });
});

describe("WEO status classification", () => {
  it("parses LATEST_ACTUAL_ANNUAL_DATA labels conservatively", () => {
    expect(parseLatestActualLabel("2025")).toBe(2025);
    expect(parseLatestActualLabel("FY2024/25")).toBe(2024);
    expect(parseLatestActualLabel(" 2019 ")).toBe(2019);
    expect(parseLatestActualLabel("")).toBeNull();
    expect(parseLatestActualLabel(null)).toBeNull();
    expect(parseLatestActualLabel("Q3 2025")).toBeNull();
  });

  it("treats a zero latest-actual label as absent", () => {
    expect(parseLatestActualLabel("0")).toBeNull();
    expect(parseLatestActualLabel("0000")).toBeNull();
  });

  it("year at the latest actual year → observed", () => {
    expect(classifyWeoStatus(2025, 2025)).toBe("observed");
    expect(classifyWeoStatus(2010, 2025)).toBe("observed");
  });

  it("year after the latest actual year → estimated", () => {
    expect(classifyWeoStatus(2025, 2024)).toBe("estimated");
    expect(classifyWeoStatus(2031, 2025)).toBe("estimated");
  });

  it("the WEO edition year after the latest actual year is still estimated, not projected", () => {
    // Oct/2026 edition, latest actual 2025: 2026 and later are IMF staff estimates.
    expect(classifyWeoStatus(2026, 2025)).toBe("estimated");
    expect(classifyWeoStatus(2027, 2025)).toBe("estimated");
  });

  it("missing latest-actual metadata → conservatively estimated, never observed", () => {
    expect(classifyWeoStatus(2000, null)).toBe("estimated");
    expect(classifyWeoStatus(2026, null)).toBe("estimated");
  });
});

describe("deriveWeoVintage", () => {
  it("maps April and September/October publications to WEO editions", () => {
    expect(deriveWeoVintage("2026-10-13T02:00:00Z")).toEqual({ vintage: "2026-10", label: "Oct/2026", year: 2026 });
    expect(deriveWeoVintage("2025-09-30T00:00:00Z")).toEqual({ vintage: "2025-10", label: "Oct/2025", year: 2025 });
    expect(deriveWeoVintage("2026-04-14T00:00:00Z")).toEqual({ vintage: "2026-04", label: "Apr/2026", year: 2026 });
  });

  it("fails on unexpected or missing publication dates", () => {
    expect(() => deriveWeoVintage("2026-07-20T00:00:00Z")).toThrow(/publication month/);
    expect(() => deriveWeoVintage(null)).toThrow(/Cannot derive/);
  });

  it("formats monthly periods in Portuguese", () => {
    expect(formatMonthlyPeriodPt("2026-09")).toBe("Set/2026");
    expect(formatMonthlyPeriodPt("2026")).toBe("2026");
  });
});

describe("normalizeWeoIndicator", () => {
  it("normalizes countries, statuses, metadata and source attribution", () => {
    const { dataset, issues } = normalizeWeoIndicator(weo(), "inflation", OPTS);
    expect(dataset.indicator.id).toBe("inflation");
    expect(dataset.source).toMatchObject({
      id: "imf_weo",
      attribution: "IMF — World Economic Outlook, Oct/2026",
      dataflow: "IMF.RES:WEO(9.0.0)",
      vintage: "2026-10",
      publishedAt: "2026-10-13T02:00:00Z",
    });
    expect(dataset.countries.map(c => c.iso3)).toEqual(["BRA", "IND", "TWN", "XKX"]);

    const bra = dataset.countries.find(c => c.iso3 === "BRA")!;
    expect(bra.latestActualYear).toBe(2025);
    expect(bra.observations).toEqual([
      [2024, "2024", 1.25, "observed"],
      [2025, "2025", 2.5, "observed"],
      [2026, "2026", 3.75, "estimated"],
      [2027, "2027", 4, "estimated"],
    ]);

    // FY2024/25 → actual through 2024 only; missing 2026 value is dropped, not zero.
    const ind = dataset.countries.find(c => c.iso3 === "IND")!;
    expect(ind.latestActualLabel).toBe("FY2024/25");
    expect(ind.observations).toEqual([
      [2024, "2024", 5.5, "observed"],
      [2025, "2025", 6.5, "estimated"],
    ]);

    // No LATEST_ACTUAL_ANNUAL_DATA → nothing claimed as observed.
    expect(dataset.countries.find(c => c.iso3 === "TWN")!.observations[0][3]).toBe("estimated");

    expect(dataset.availableYears).toEqual([2024, 2025, 2026, 2027]);
    expect(dataset.latestReferencePeriod).toBe("2027");
    expect(issues.unmapped).toEqual([]);
    expect(issues.errors).toEqual([]);
  });

  it("filters by indicator and drops years before startYear", () => {
    const { dataset } = normalizeWeoIndicator(weo(), "unemployment", OPTS);
    expect(dataset.countries.map(c => c.iso3)).toEqual(["BRA"]);
    expect(dataset.countries[0].latestActualYear).toBeNull();
    const infl = normalizeWeoIndicator(weo(), "inflation", OPTS).dataset;
    expect(infl.availableYears).not.toContain(1999);
  });

  it("skips aggregates and reports unknown country codes", () => {
    const parsed = weo();
    parsed.series.push({ country: "ZZZ", indicator: "PCPIPCH", frequency: "A", observations: [{ period: "2025", value: "1" }] });
    const { issues, dataset } = normalizeWeoIndicator(parsed, "inflation", OPTS);
    expect(issues.unmapped).toEqual(["ZZZ"]);
    expect(dataset.unmappedSourceCodes).toEqual(["ZZZ"]);
    expect(isWeoAggregateCode("G001")).toBe(true);
    expect(isWeoAggregateCode("GX123")).toBe(true);
    expect(isWeoAggregateCode("GHA")).toBe(false);
  });

  it("records invalid numeric values instead of keeping them", () => {
    const parsed = weo();
    parsed.series[0].observations.push({ period: "2028", value: "abc" });
    const { issues, dataset } = normalizeWeoIndicator(parsed, "inflation", OPTS);
    expect(issues.invalidValues).toEqual(['PCPIPCH BRA 2028: "abc"']);
    expect(dataset.countries.find(c => c.iso3 === "BRA")!.observations.map(o => o[0])).not.toContain(2028);
  });

  it("collapses identical duplicates and flags conflicting ones", () => {
    const parsed = weo();
    parsed.series.push({ country: "BRA", indicator: "PCPIPCH", frequency: "A", observations: [{ period: "2025", value: "2.5" }] });
    expect(normalizeWeoIndicator(parsed, "inflation", OPTS).issues.duplicatesCollapsed).toBe(1);

    parsed.series.push({ country: "BRA", indicator: "PCPIPCH", frequency: "A", observations: [{ period: "2025", value: "9" }] });
    expect(normalizeWeoIndicator(parsed, "inflation", OPTS).issues.conflicts).toEqual(["PCPIPCH BRA 2025: 2.5 vs 9"]);
  });

  it("produces identical output regardless of input order", () => {
    const a = weo();
    const b = weo();
    b.series.reverse();
    for (const s of b.series) s.observations.reverse();
    expect(normalizeWeoIndicator(b, "inflation", OPTS).dataset).toEqual(normalizeWeoIndicator(a, "inflation", OPTS).dataset);
  });

  it("never emits projected for WEO", () => {
    const { dataset } = normalizeWeoIndicator(weo(), "inflation", OPTS);
    const statuses = new Set(dataset.countries.flatMap(c => c.observations.map(o => o[3])));
    expect(statuses.has("projected")).toBe(false);
    expect([...statuses].sort()).toEqual(["estimated", "observed"]);
  });

  it("classifies observations conservatively when LATEST_ACTUAL_ANNUAL_DATA is zero", () => {
    const parsed = weo();
    parsed.latestActual.set("BRA|PCPIPCH", "0");
    const { dataset, issues } = normalizeWeoIndicator(parsed, "inflation", OPTS);
    const bra = dataset.countries.find(c => c.iso3 === "BRA")!;
    expect(bra.latestActualYear).toBeNull();
    expect(bra.observations.every(o => o[3] === "estimated")).toBe(true);
    expect(issues.errors).toEqual([]);
  });

  it("null/missing values are not stored (they surface as no_data)", () => {
    const { dataset } = normalizeWeoIndicator(weo(), "inflation", OPTS);
    // IND 2026 has no OBS_VALUE in the fixture.
    expect(dataset.countries.find(c => c.iso3 === "IND")!.observations.some(o => o[0] === 2026)).toBe(false);
  });

  it("rejects unexpected frequency and unrecognized latest-actual labels", () => {
    const parsed = weo();
    parsed.series.push({ country: "CHL", indicator: "PCPIPCH", frequency: "Q", observations: [] });
    parsed.latestActual.set("BRA|PCPIPCH", "sometime");
    const { issues } = normalizeWeoIndicator(parsed, "inflation", OPTS);
    expect(issues.errors.some(e => /unexpected frequency Q/.test(e))).toBe(true);
    expect(issues.errors.some(e => /unrecognized LATEST_ACTUAL_ANNUAL_DATA "sometime"/.test(e))).toBe(true);
  });

  it("refuses non-WEO indicators", () => {
    expect(() => normalizeWeoIndicator(weo(), "policy_rate", OPTS)).toThrow(/not a WEO indicator/);
  });
});

describe("resolveLastMonthlyByYear", () => {
  it("picks the last available month within each calendar year", () => {
    expect(resolveLastMonthlyByYear([
      ["2024-03", 1, "BR"], ["2024-12", 2, "BR"], ["2024-06", 3, "BR"],
      ["2025-01", 4, "BR"],
    ])).toEqual([
      [2024, "2024-12", 2, "observed", "BR"],
      [2025, "2025-01", 4, "observed", "BR"],
    ]);
  });

  it("uses the latest available month for an incomplete (current) year", () => {
    const out = resolveLastMonthlyByYear([["2026-08", 5, "BR"], ["2026-09", 6, "BR"]]);
    expect(out).toEqual([[2026, "2026-09", 6, "observed", "BR"]]);
  });

  it("rejects malformed periods", () => {
    expect(() => resolveLastMonthlyByYear([["2026-13", 1, "BR"]])).toThrow(/Invalid monthly period/);
    expect(() => resolveLastMonthlyByYear([["2026", 1, "BR"]])).toThrow(/Invalid monthly period/);
  });
});

describe("normalizeBisPolicyRates", () => {
  it("normalizes the SDMX-CSV fixture", () => {
    const { dataset, issues } = normalizeBisPolicyRates(parseBisPolicyRateCsv(BIS_CSV_FIXTURE), OPTS);
    expect(dataset.indicator.id).toBe("policy_rate");
    const byIso = new Map(dataset.countries.map(c => [c.iso3, c]));

    expect(byIso.get("BRA")!.observations).toEqual([
      [2024, "2024-12", 11, "observed", "BR"],
      [2025, "2025-12", 12, "observed", "BR"],
      [2026, "2026-09", 13, "observed", "BR"],
    ]);

    // 2025-12 is NaN (OBS_STATUS M) → last *available* month is 2025-11.
    expect(byIso.get("USA")!.observations).toEqual([[2025, "2025-11", 4.25, "observed", "US"]]);

    // Euro area kept as a reference-area aggregate, never as an ISO-3 country…
    expect(dataset.aggregates).toEqual([
      { sourceCode: "XM", name: "Área do euro (BCE)", observations: [[2026, "2026-09", 2, "observed", "XM"]] },
    ]);
    expect(dataset.countries.some(c => c.iso3 === "XM" || c.iso3 === "XMX")).toBe(false);
    // …and applied to members (all members by 2026, incl. BGR from 2026-01).
    expect(byIso.get("DEU")).toEqual({ iso3: "DEU", euroAreaAdoption: "1999-01", observations: [[2026, "2026-09", 2, "observed", "XM"]] });
    expect(byIso.get("BGR")!.observations).toEqual([[2026, "2026-09", 2, "observed", "XM"]]);
    expect(byIso.has("POL")).toBe(false);

    expect(dataset.availableYears).toEqual([2024, 2025, 2026]);
    expect(dataset.latestReferencePeriod).toBe("2026-09");
    expect(dataset.source).toMatchObject({
      id: "bis_cbpol",
      attribution: "BIS — Central bank policy rates",
      dataflow: "BIS:WS_CBPOL(1.0)",
      vintage: "2026-09",
      vintageLabel: "Set/2026",
    });
    expect(issues.errors).toEqual([]);
    expect(issues.unmapped).toEqual([]);
  });

  it("reports unmapped areas and invalid values", () => {
    const { issues, dataset } = normalizeBisPolicyRates([
      bisRow("BR", "2026-01", "10"),
      bisRow("4T", "2026-01", "5"),
      bisRow("BR", "2026-02", "ten"),
    ], OPTS);
    expect(issues.unmapped).toEqual(["4T"]);
    expect(issues.invalidValues).toEqual(['BIS BR 2026-02: "ten"']);
    expect(dataset.countries.find(c => c.iso3 === "BRA")!.observations).toEqual([[2026, "2026-01", 10, "observed", "BR"]]);
  });

  it("rejects unexpected units, frequencies and periods", () => {
    const { issues } = normalizeBisPolicyRates([
      bisRow("BR", "2026-01", "10", { unitMeasure: "999" }),
      bisRow("BR", "2026-01-15", "10", { freq: "D" }),
      bisRow("BR", "2026-1", "10"),
    ], OPTS);
    expect(issues.errors).toHaveLength(3);
  });

  it("flags conflicting duplicate months", () => {
    const { issues } = normalizeBisPolicyRates([bisRow("BR", "2026-01", "10"), bisRow("BR", "2026-01", "11")], OPTS);
    expect(issues.conflicts).toEqual(["BIS BR 2026-01: 10 vs 11"]);
  });

  it("is order-independent", () => {
    const rows = parseBisPolicyRateCsv(BIS_CSV_FIXTURE);
    const a = normalizeBisPolicyRates(rows, OPTS).dataset;
    const b = normalizeBisPolicyRates([...rows].reverse(), OPTS).dataset;
    expect(b).toEqual(a);
  });
});

describe("euro-area policy rate", () => {
  const rows = [
    // National pre-euro series (as published by BIS for FR/DE/GR/HR)
    bisRow("FR", "1998-11", "3.3"), bisRow("FR", "1998-12", "3"),
    bisRow("DE", "1998-12", "3"),
    bisRow("GR", "1999-12", "11"), bisRow("GR", "2000-12", "8"),
    bisRow("HR", "2021-12", "2.5"), bisRow("HR", "2022-07", "2.5"),
    // A national value after adoption must never be used.
    bisRow("FR", "1999-03", "9.99"),
    // ECB rate
    bisRow("XM", "1999-01", "3"), bisRow("XM", "1999-12", "3"),
    bisRow("XM", "2000-12", "4.75"), bisRow("XM", "2001-12", "3.25"),
    bisRow("XM", "2022-12", "2.5"), bisRow("XM", "2023-12", "4.5"),
    // Non-euro EU members with their own series
    bisRow("PL", "2001-12", "11.5"), bisRow("PL", "2023-12", "5.75"),
    bisRow("GB", "2023-12", "5.25"),
  ];
  const ds = normalizeBisPolicyRates(rows, { ...OPTS, startYear: 1990 }).dataset;
  const obs = (iso3: string) => new Map(ds.countries.find(c => c.iso3 === iso3)?.observations.map(o => [o[0], o]) ?? []);

  it("FRA before the common monetary policy uses its national series", () => {
    expect(obs("FRA").get(1998)).toEqual([1998, "1998-12", 3, "observed", "FR"]);
  });

  it("FRA and DEU from 1999 use XM, and the national post-adoption value is ignored", () => {
    expect(obs("FRA").get(1999)).toEqual([1999, "1999-12", 3, "observed", "XM"]);
    expect(obs("DEU").get(1999)).toEqual([1999, "1999-12", 3, "observed", "XM"]);
    expect(obs("DEU").get(2023)).toEqual([2023, "2023-12", 4.5, "observed", "XM"]);
    expect([...obs("FRA").values()].some(o => o[2] === 9.99)).toBe(false);
  });

  it("a later entrant switches only from its actual accession month", () => {
    // Greece joined on 2001-01: national through 2000, XM from 2001.
    expect(obs("GRC").get(1999)).toEqual([1999, "1999-12", 11, "observed", "GR"]);
    expect(obs("GRC").get(2000)).toEqual([2000, "2000-12", 8, "observed", "GR"]);
    expect(obs("GRC").get(2001)).toEqual([2001, "2001-12", 3.25, "observed", "XM"]);
    // Croatia joined on 2023-01: 2022 keeps the last national month, XM from 2023.
    expect(obs("HRV").get(2022)).toEqual([2022, "2022-07", 2.5, "observed", "HR"]);
    expect(obs("HRV").get(2023)).toEqual([2023, "2023-12", 4.5, "observed", "XM"]);
    // Slovakia (2009-01) never receives pre-2009 XM values.
    expect([...obs("SVK").keys()].every(y => y >= 2009)).toBe(true);
    expect(ds.countries.find(c => c.iso3 === "GRC")!.euroAreaAdoption).toBe("2001-01");
  });

  it("non-euro EU countries never receive XM", () => {
    expect([...obs("POL").values()].map(o => o[4])).toEqual(["PL", "PL"]);
    expect([...obs("GBR").values()].map(o => o[4])).toEqual(["GB"]);
    for (const iso3 of ["DNK", "SWE", "HUN", "CZE", "ROU"]) expect(obs(iso3).size).toBe(0);
    for (const c of ds.countries) {
      if (!c.euroAreaAdoption) expect(c.observations.some(o => o[4] === "XM"), c.iso3).toBe(false);
    }
  });

  it("keeps the member country as the displayed geography and records XM as the source area", () => {
    const fra = ds.countries.find(c => c.iso3 === "FRA")!;
    expect(fra.iso3).toBe("FRA");
    expect(fra.observations.filter(o => o[0] >= 1999).every(o => o[4] === "XM")).toBe(true);
    expect(ds.aggregates.map(a => a.sourceCode)).toEqual(["XM"]);
  });

  it("combinePolicyRateSeries is a strict dated switch", () => {
    const national = [["2000-12", 8, "GR"], ["2001-06", 99, "GR"]] as const;
    const xm = [["2000-12", 4.75, "XM"], ["2001-01", 4.75, "XM"]] as const;
    expect(combinePolicyRateSeries("GRC", national, xm)).toEqual([["2000-12", 8, "GR"], ["2001-01", 4.75, "XM"]]);
    expect(combinePolicyRateSeries("POL", [["2001-01", 19, "PL"]], xm)).toEqual([["2001-01", 19, "PL"]]);
  });
});
