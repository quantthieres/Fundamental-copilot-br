import { describe, it, expect } from "vitest";
import { parseFinancialsCache, parseDocumentsCache, parseQuarterlyCache } from "./precomputed-cache";

// ─── parseFinancialsCache ─────────────────────────────────────────────────────

describe("parseFinancialsCache", () => {
  it("parses valid financials JSON", () => {
    const result = parseFinancialsCache(
      JSON.stringify({ financials: [{ ticker: "WEGE3", fiscalYear: 2023, revenue: 10 }] }),
    );
    expect(result).toHaveLength(1);
    expect(result![0].ticker).toBe("WEGE3");
  });

  it("returns empty array for empty financials array", () => {
    const result = parseFinancialsCache(JSON.stringify({ financials: [] }));
    expect(result).toEqual([]);
  });

  it("returns null when financials field is missing", () => {
    expect(parseFinancialsCache(JSON.stringify({ ticker: "WEGE3" }))).toBeNull();
  });

  it("returns null when financials is not an array", () => {
    expect(parseFinancialsCache(JSON.stringify({ financials: "nope" }))).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseFinancialsCache("not-json")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseFinancialsCache("")).toBeNull();
  });
});

// ─── parseDocumentsCache ──────────────────────────────────────────────────────

describe("parseDocumentsCache", () => {
  it("parses valid documents JSON", () => {
    const result = parseDocumentsCache(
      JSON.stringify({ companyName: "WEG S.A.", documents: [{ id: "1", date: "2024-01-01", category: "DFP", title: "t", source: "CVM" }] }),
    );
    expect(result?.companyName).toBe("WEG S.A.");
    expect(result?.documents).toHaveLength(1);
  });

  it("returns empty documents array when documents is empty", () => {
    const result = parseDocumentsCache(JSON.stringify({ companyName: "WEG S.A.", documents: [] }));
    expect(result?.documents).toEqual([]);
  });

  it("returns null when documents field is missing", () => {
    expect(parseDocumentsCache(JSON.stringify({ companyName: "WEG S.A." }))).toBeNull();
  });

  it("returns null when companyName is missing", () => {
    expect(parseDocumentsCache(JSON.stringify({ documents: [] }))).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseDocumentsCache("{bad}")).toBeNull();
  });
});

// ─── parseQuarterlyCache (E) ──────────────────────────────────────────────────

const VALID_QUARTERLY_RECORD = {
  ticker:            "WEGE3",
  fiscalYear:        2024,
  quarter:           1,
  period:            "2024Q1",
  periodEndDate:     "2024-03-31",
  revenue:           2.5,
  ebit:              0.4,
  netIncome:         0.3,
  operatingCashFlow: 0.5,
  capex:             0.1,
  freeCashFlow:      0.4,
  cash:              1.0,
  totalDebt:         0.8,
  netDebt:           -0.2,
  source:            "cvm_itr",
};

describe("parseQuarterlyCache", () => {
  it("parses valid quarterly JSON and returns the array", () => {
    const result = parseQuarterlyCache(
      JSON.stringify({ quarterly: [VALID_QUARTERLY_RECORD] }),
    );
    expect(result).toHaveLength(1);
    expect(result![0].ticker).toBe("WEGE3");
    expect(result![0].quarter).toBe(1);
    expect(result![0].source).toBe("cvm_itr");
  });

  it("returns empty array when quarterly array is empty", () => {
    expect(parseQuarterlyCache(JSON.stringify({ quarterly: [] }))).toEqual([]);
  });

  it("returns null when quarterly field is missing", () => {
    expect(parseQuarterlyCache(JSON.stringify({ ticker: "WEGE3" }))).toBeNull();
  });

  it("returns null when quarterly is not an array", () => {
    expect(parseQuarterlyCache(JSON.stringify({ quarterly: "nope" }))).toBeNull();
  });

  it("returns null when first element is missing ticker", () => {
    const bad = { ...VALID_QUARTERLY_RECORD };
    // @ts-expect-error intentional bad shape
    delete bad.ticker;
    expect(parseQuarterlyCache(JSON.stringify({ quarterly: [bad] }))).toBeNull();
  });

  it("returns null when first element has wrong fiscalYear type", () => {
    const bad = { ...VALID_QUARTERLY_RECORD, fiscalYear: "2024" };
    expect(parseQuarterlyCache(JSON.stringify({ quarterly: [bad] }))).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseQuarterlyCache("not-json")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseQuarterlyCache("")).toBeNull();
  });

  it("returns null for non-object JSON", () => {
    expect(parseQuarterlyCache("42")).toBeNull();
  });
});
