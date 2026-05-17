import { describe, it, expect } from "vitest";
import { B3_UNIVERSE } from "@/data/b3-universe";
import {
  normalizeSearchText,
  buildTickerSearchIndex,
  searchTickers,
  findExactTicker,
} from "./ticker-search";

const INDEX = buildTickerSearchIndex(B3_UNIVERSE);

// ── normalizeSearchText ───────────────────────────────────────────────────────

describe("normalizeSearchText", () => {
  it("lowercases", () => {
    expect(normalizeSearchText("WEGE3")).toBe("wege3");
  });

  it("trims whitespace", () => {
    expect(normalizeSearchText("  vale  ")).toBe("vale");
  });

  it("strips Portuguese diacritics", () => {
    expect(normalizeSearchText("Petróleo")).toBe("petroleo");
    expect(normalizeSearchText("São")).toBe("sao");
    expect(normalizeSearchText("Ação")).toBe("acao");
    expect(normalizeSearchText("Celulose")).toBe("celulose");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeSearchText("")).toBe("");
    expect(normalizeSearchText("   ")).toBe("");
  });
});

// ── buildTickerSearchIndex ────────────────────────────────────────────────────

describe("buildTickerSearchIndex", () => {
  it("returns one entry per asset", () => {
    expect(INDEX.length).toBe(B3_UNIVERSE.length);
  });

  it("normalizes ticker to lowercase", () => {
    const wege = INDEX.find(e => e.asset.ticker === "WEGE3");
    expect(wege?.nTicker).toBe("wege3");
  });

  it("strips diacritics from companyName", () => {
    const petr = INDEX.find(e => e.asset.ticker === "PETR4");
    expect(petr?.nCompanyName).not.toContain("é");
  });
});

// ── searchTickers ─────────────────────────────────────────────────────────────

describe("searchTickers", () => {
  it("returns empty for empty query", () => {
    expect(searchTickers(INDEX, "")).toHaveLength(0);
    expect(searchTickers(INDEX, "   ")).toHaveLength(0);
  });

  it("finds WEGE3 by 'weg'", () => {
    const results = searchTickers(INDEX, "weg");
    expect(results.map(r => r.ticker)).toContain("WEGE3");
  });

  it("finds WEGE3 by 'WEG' (case-insensitive)", () => {
    const results = searchTickers(INDEX, "WEG");
    expect(results.map(r => r.ticker)).toContain("WEGE3");
  });

  it("finds PETR3 and PETR4 by 'petro'", () => {
    const tickers = searchTickers(INDEX, "petro").map(r => r.ticker);
    expect(tickers).toContain("PETR3");
    expect(tickers).toContain("PETR4");
  });

  it("finds VALE3 by 'vale'", () => {
    const tickers = searchTickers(INDEX, "vale").map(r => r.ticker);
    expect(tickers).toContain("VALE3");
  });

  it("finds MGLU3 by 'magazine'", () => {
    const tickers = searchTickers(INDEX, "magazine").map(r => r.ticker);
    expect(tickers).toContain("MGLU3");
  });

  it("finds MGLU3 by 'mglu'", () => {
    const tickers = searchTickers(INDEX, "mglu").map(r => r.ticker);
    expect(tickers).toContain("MGLU3");
  });

  it("finds by tradingName 'Magalu'", () => {
    const tickers = searchTickers(INDEX, "magalu").map(r => r.ticker);
    expect(tickers).toContain("MGLU3");
  });

  it("finds by sector 'mineracao' (diacritic-free)", () => {
    const tickers = searchTickers(INDEX, "mineracao").map(r => r.ticker);
    expect(tickers).toContain("VALE3");
  });

  it("exact ticker match sorts first", () => {
    const results = searchTickers(INDEX, "PETR4");
    expect(results[0].ticker).toBe("PETR4");
  });

  it("ticker-prefix match sorts before substring match", () => {
    const results = searchTickers(INDEX, "gg");
    const tickers = results.map(r => r.ticker);
    const ggbrIdx = tickers.findIndex(t => t.startsWith("GG"));
    const otherIdx = tickers.findIndex(t => !t.startsWith("GG"));
    if (ggbrIdx !== -1 && otherIdx !== -1) {
      expect(ggbrIdx).toBeLessThan(otherIdx);
    }
  });

  it("respects maxResults", () => {
    const results = searchTickers(INDEX, "a", 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("returns at most 10 by default", () => {
    const results = searchTickers(INDEX, "a");
    expect(results.length).toBeLessThanOrEqual(10);
  });
});

// ── findExactTicker ───────────────────────────────────────────────────────────

describe("findExactTicker", () => {
  it("finds WEGE3 by exact ticker (lowercase)", () => {
    expect(findExactTicker(INDEX, "wege3")?.ticker).toBe("WEGE3");
  });

  it("finds WEGE3 by exact ticker (uppercase)", () => {
    expect(findExactTicker(INDEX, "WEGE3")?.ticker).toBe("WEGE3");
  });

  it("returns undefined for unknown ticker", () => {
    expect(findExactTicker(INDEX, "XXXX9")).toBeUndefined();
  });

  it("does not match partial tickers", () => {
    expect(findExactTicker(INDEX, "WEG")).toBeUndefined();
  });
});
