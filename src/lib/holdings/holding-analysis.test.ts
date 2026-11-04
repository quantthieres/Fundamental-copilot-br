import { describe, expect, it } from "vitest";
import { readHoldingCache } from "./holding-cache";
import { buildHoldingAnalysisResponse, type HoldingAnalysisAvailable } from "./holding-analysis";

const M = 1_000_000;
function analysis(ticker: string): HoldingAnalysisAvailable {
  const r = buildHoldingAnalysisResponse(ticker, readHoldingCache(ticker));
  if (!r.available) throw new Error(r.message);
  return r;
}

describe("holding analysis payload — requested vs canonical ticker", () => {
  it("ITSA3 reads the ITSA4 issuer cache and keeps the requested share class", () => {
    const a = analysis("ITSA3");
    expect(a).toMatchObject({ requestedTicker: "ITSA3", canonicalTicker: "ITSA4", analysisStatus: "ready" });
    expect(a.issuer).toMatchObject({ cvmCode: "7617", cnpj: "61.532.644/0001-15", statementBasis: "individual" });
    expect(a.requestedShareClass).toMatchObject({ ticker: "ITSA3", kind: "ON", isin: "BRITSAACNOR0" });
    expect(a.shareClasses.map(c => c.ticker)).toEqual(["ITSA3", "ITSA4"]);
  });

  it("BRAP3 reads the BRAP4 issuer cache", () => {
    const a = analysis("BRAP3");
    expect(a).toMatchObject({ requestedTicker: "BRAP3", canonicalTicker: "BRAP4" });
    expect(a.issuer.cvmCode).toBe("18724");
    expect(a.requestedShareClass.kind).toBe("ON");
  });

  it("both share classes of an issuer get identical fundamentals", () => {
    for (const [on, pn] of [["ITSA3", "ITSA4"], ["BRAP3", "BRAP4"]]) {
      const a = analysis(on), b = analysis(pn);
      expect(a.indicators).toEqual(b.indicators);
      expect(a.portfolio).toEqual(b.portfolio);
      expect(a.statement).toEqual(b.statement);
    }
  });

  it("unsupported ticker and missing cache are explicit, never another model", () => {
    expect(buildHoldingAnalysisResponse("ITUB4", readHoldingCache("ITUB4"))).toMatchObject({
      available: false, reason: "unsupported_ticker", canonicalTicker: null,
    });
    expect(buildHoldingAnalysisResponse("ITSA3", null)).toMatchObject({
      available: false, reason: "cache_unavailable", requestedTicker: "ITSA3", canonicalTicker: "ITSA4",
    });
  });

  it("carries no market quote and no internal parser fields", () => {
    const json = JSON.stringify(analysis("BRAP4"));
    for (const key of ['"quote"', '"price":null', '"accounts"', '"diagnostics"', '"checks"', '"footnote"', '"issues"']) {
      expect(json, key).not.toContain(key);
    }
  });
});

describe("holding analysis payload — production anchors (BRL units)", () => {
  it("Itaúsa", () => {
    const a = analysis("ITSA4");
    const c = a.indicators.core;
    expect(a.portfolio!.officialPortfolioValue).toBe(199_950 * M);
    expect(c.officialMarketValue.value).toBe(163_627 * M);
    expect(c.officialDiscount.value).toBe(-0.182);
    expect(c.largestInvesteeConcentration).toMatchObject({ value: 0.91017, investee: "Itaú Unibanco" });
    expect(a.statement).toMatchObject({ periodEnd: "2026-06-30", cash: 2_191 * M, grossDebt: 3_375 * M, netDebt: 1_184 * M });
    expect(c.holdingCash.value).toBe(2_191 * M);
    expect(c.dividendsReceivedTtm.value).toBe(12_498 * M);
  });

  it("Bradespar", () => {
    const a = analysis("BRAP4");
    const pf = a.portfolio!;
    expect(pf.investees).toHaveLength(1);
    expect(pf.investees[0]).toMatchObject({ name: "Vale", value: 10_131_252_000, sharesHeld: 163_354_595, pricePerShare: 62.02, ownershipPct: 0.0384 });
    expect(pf.publishedNetCash).toEqual({ value: 511_033_000, referenceDate: "2026-10-30" });
    expect(pf.officialPortfolioValue).toBe(10_642_285_000);
    expect(pf.officialMarketValue.value).toBe(7_014_908_000);
    expect(pf.officialDiscount.value).toBe(-0.341);
    expect(a.statement).toMatchObject({ periodEnd: "2026-06-30", cash: 254_451_000, grossDebt: 0, netDebt: -254_451_000 });
    expect(a.indicators.core.dividendsReceivedTtm.value).toBe(809_817_000);
  });
});

describe("holding analysis payload — portfolio semantics", () => {
  it("Itaúsa: seven investees; Demais Ativos e Passivos is a reconciliation line, not an investee", () => {
    const pf = analysis("ITSA3").portfolio!;
    expect(pf.investees.map(c => c.name)).toEqual(["Itaú Unibanco", "Dexco", "Alpargatas", "Motiva", "Aegea", "Copa Energia", "NTS"]);
    expect(pf.otherAssetsLiabilities).toEqual([expect.objectContaining({ name: "Demais Ativos e Passivos", value: -1_241 * M, shareOfPositiveInvestees: null })]);
    expect(pf.positiveInvesteeTotal).toBe(201_191 * M);
    expect(pf.investees[0].shareOfPositiveInvestees).toBeCloseTo(183_118 / 201_191, 10);
    const shares = pf.investees.reduce((s, c) => s + c.shareOfPositiveInvestees!, 0);
    expect(shares).toBeCloseTo(1, 10);
    expect(pf.publishedNetCash).toBeNull();
  });

  it("Bradespar: statement net debt (30/06) and bulletin net cash (30/10) stay separate", () => {
    const a = analysis("BRAP3");
    expect(a.statement!.netDebt).toBe(-254_451_000);
    expect(a.portfolio!.publishedNetCash!.value).toBe(511_033_000);
    expect(a.portfolio!.investees[0].value + a.portfolio!.publishedNetCash!.value).toBe(a.portfolio!.officialPortfolioValue);
    expect(a.portfolio!.otherAssetsLiabilities).toEqual([]);
    expect(a.notices.find(n => n.code === "statement_vs_publication_dates")!.message).toMatch(/30\/06\/2026.*30\/10\/2026/);
  });

  it("Itaúsa NTS stays out of cash", () => {
    const st = analysis("ITSA4").statement!;
    expect(st.shortTermInvestments).toEqual({ value: 1_505 * M, classification: "portfolio_investment", includedInCash: false });
    expect(st.cash).toBe(2_191 * M);
  });
});

describe("holding analysis payload — notices", () => {
  it("methodology notes are informational; a fresh cache has no warnings", () => {
    const itsa = analysis("ITSA4").notices;
    expect(itsa.filter(n => n.severity === "warning")).toEqual([]);
    expect(itsa.map(n => n.code)).toEqual(expect.arrayContaining(["mixed_value_bases", "market_value_method"]));
    expect(itsa.map(n => n.code)).not.toContain("published_ownership_denominator");
    const brap = analysis("BRAP4").notices;
    expect(brap.find(n => n.code === "published_ownership_denominator")).toMatchObject({ severity: "info", message: expect.stringContaining("3,84%") });
    expect(brap.map(n => n.code)).not.toContain("mixed_value_bases");
  });

  it("preserved/stale portfolio → limited with warnings", () => {
    const cache = structuredClone(readHoldingCache("BRAP4")!);
    cache.enrichment = { statements: "ok", portfolio: "preserved", issues: ["portfolio source failed (HTTP 503)"] };
    cache.portfolioFreshness = { ...cache.portfolioFreshness, status: "stale", quarterLag: 2 };
    const r = buildHoldingAnalysisResponse("BRAP3", cache);
    if (!r.available) throw new Error("expected available");
    expect(r.analysisStatus).toBe("limited");
    expect(r.notices.filter(n => n.severity === "warning").map(n => n.code)).toEqual(["portfolio_preserved", "portfolio_stale"]);
    expect(JSON.stringify(r)).not.toContain("HTTP 503");   // internal diagnostics stay internal
  });

  it("never uses valuation language", () => {
    for (const t of ["ITSA4", "BRAP4"]) {
      // "valor justo contabilizado" is the documented basis of a specific asset (NTS), not a conclusion.
      const text = analysis(t).notices.map(n => n.message).join(" ").toLowerCase().replaceAll("valor justo contabilizado", "");
      for (const word of ["upside", "potencial", "oportunidade", "barat", "atrativ", "preço-alvo", "valor justo", "recomenda"]) {
        expect(text, `${t}: ${word}`).not.toContain(word);
      }
    }
  });
});
