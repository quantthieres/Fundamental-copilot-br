import { describe, it, expect } from "vitest";
import { parseFinancialsCache, parseDocumentsCache } from "./precomputed-cache";

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
