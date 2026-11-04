import { describe, expect, it } from "vitest";
import { fixtureText } from "./__fixtures__/fixtures";
import { classifyItausaFootnote, parseItausaPortfolioHtml } from "./itausa-portfolio";
import type { HoldingPortfolio } from "./holding-types";

// Verbatim excerpt of the official page (dateModified 2026-10-15) — no network.
const HTML = fixtureText("itausa-portfolio-2026-10-15.html");
const M = 1_000_000;

function parse(html = HTML): HoldingPortfolio {
  const r = parseItausaPortfolioHtml(html);
  if (!r.ok) throw new Error(r.error);
  return r.portfolio;
}
const component = (p: HoldingPortfolio, name: string) => p.components.find(c => c.name === name)!;

describe("Itaúsa portfolio page", () => {
  it("reads the snapshot dates and official totals", () => {
    const p = parse();
    expect(p.portfolioReferenceDate).toBe("2026-09-30");
    expect(p.portfolioPublicationDate).toBe("2026-10-15");
    expect(p.officialPortfolioValue).toBe(199_950 * M);
    expect(p.officialMarketValue).toEqual({
      value: 163_627 * M,
      method: "most_liquid_class_price_times_total_ex_treasury_shares",
      priceReferenceDate: "2026-09-30",
      classes: [{ ticker: "ITSA4", price: 14.6, shares: 11_207 * M, sharesScope: "all_classes_ex_treasury", value: null }],
    });
    expect(p.officialDiscount).toEqual({
      value: -0.182, published: "-18,2%", formula: "officialMarketValue / officialPortfolioValue - 1", signConvention: "published_signed",
    });
    expect(p.standardizedClassWeightedMarketCap).toBeNull();
    expect(p.publishedNetCash).toBeNull();
  });

  it("parses every current component, in order", () => {
    expect(parse().components.map(c => [c.name, c.value / M, c.valueBasis])).toEqual([
      ["Itaú Unibanco", 183_118, "market_price"],
      ["Dexco", 1_991, "market_price"],
      ["Alpargatas", 2_949, "market_price"],
      ["Motiva", 3_495, "market_price"],
      ["Aegea", 6_108, "mixed_transaction_and_book"],
      ["Copa Energia", 2_025, "book_value"],
      ["NTS", 1_505, "booked_fair_value"],
      ["Demais Ativos e Passivos", -1_241, "other_assets_liabilities"],
    ]);
  });

  it("listed components carry the ticker, price and date from footnote (A)", () => {
    expect(component(parse(), "Itaú Unibanco")).toMatchObject({
      ticker: "ITUB4", listed: true, ownershipPct: 0.375, ownershipReferenceDate: "2026-06-30",
      pricePerShare: 44.28, investeeTotalShares: 11_022 * M, investeeMarketValue: 488_055 * M, valueReferenceDate: "2026-09-30",
    });
    expect(parse().components.filter(c => c.listed).map(c => c.ticker)).toEqual(["ITUB4", "DXCO3", "ALPA4", "MOTV3"]);
  });

  it("keeps the mixed and report-based bases separate (not homogeneous)", () => {
    const p = parse();
    expect(component(p, "Aegea")).toMatchObject({
      ticker: null, listed: false, ownershipPct: 0.14, valueReferenceDate: null,
      parts: [
        { basis: "transaction_price", value: 5_280 * M, referenceDate: null },
        { basis: "book_value", value: 828 * M, referenceDate: "2026-06-30" },
      ],
    });
    expect(component(p, "Copa Energia")).toMatchObject({ valueBasis: "book_value", valueReferenceDate: "2026-06-30", ownershipPct: 0.489 });
    expect(component(p, "NTS")).toMatchObject({ valueBasis: "booked_fair_value", valueReferenceDate: "2026-06-30", ownershipPct: 0.085 });
  });

  it("stores Demais Ativos e Passivos as published, from the official source", () => {
    expect(component(parse(), "Demais Ativos e Passivos")).toMatchObject({
      kind: "other_assets_liabilities", value: -1_241 * M, valueBasis: "other_assets_liabilities",
      valueReferenceDate: "2026-06-30", footnote: "Considera o balanço individual de 30.06.2026.",
    });
  });

  it("validates the official arithmetic", () => {
    const { validation } = parse();
    expect(validation.status).toBe("passed");
    expect(validation.checks.find(c => c.name === "sum of parts = Σ components")).toMatchObject({ published: 199_950, computed: 199_950, passed: true });
    expect(validation.checks.find(c => c.name.startsWith("discount"))).toMatchObject({ published: -0.182, passed: true });
    expect(validation.checks.find(c => c.name.startsWith("itausa_market_value = price"))).toMatchObject({ passed: true });
  });

  it("rejects a snapshot whose total does not add up", () => {
    const r = parseItausaPortfolioHtml(HTML.replace("<strong>199.950</strong>", "<strong>201.950</strong>"));
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/sum of parts/) });
  });

  it("rejects a discount inconsistent with the published values", () => {
    expect(parseItausaPortfolioHtml(HTML.replace("-18,2%", "-28,2%")).ok).toBe(false);
  });

  it("fails closed on a changed table layout", () => {
    expect(parseItausaPortfolioHtml(HTML.replace("TOTAL DE AÇÕES", "QUANTIDADE"))).toMatchObject({ ok: false, error: expect.stringMatching(/header/) });
    expect(parseItausaPortfolioHtml("<html></html>").ok).toBe(false);
    expect(parseItausaPortfolioHtml(HTML.replace("Total de ações emitidas menos ações em tesouraria", "Total de ações")).ok).toBe(false);
  });

  it("keeps a new component generically and warns", () => {
    const extra = `<tr style="height: 28px">
<td style="height: 28px">Nova Investida<sup>(E)</sup></td>
<td style="text-align: center;height: 28px">n/a</td><td style="text-align: center;height: 28px">n/a</td><td style="text-align: center;height: 28px">n/a</td>
<td style="text-align: center;height: 28px">5,0%</td><td style="text-align: center;height: 28px">100</td>
</tr>
<tr style="height: 28px">
<td style="height: 28px"><strong>Demais`;
    const html = HTML.replace(`<tr style="height: 28px">\n<td style="height: 28px"><strong>Demais`, extra)
      .replace("<strong>199.950</strong>", "<strong>200.050</strong>")
      .replace("<strong>-18,2%</strong>", "<strong>-18,2%</strong>");
    const r = parseItausaPortfolioHtml(html);
    if (!r.ok) throw new Error(r.error);
    expect(r.portfolio.components.find(c => c.name === "Nova Investida")).toMatchObject({ value: 100 * M, valueBasis: "book_value" });
    expect(r.warnings).toContain("portfolio composition changed — new: Nova Investida");
  });

  it("an unrecognized footnote is stored as unclassified, never guessed", () => {
    expect(classifyItausaFootnote("Considera estimativa interna.").basis).toBe("unclassified");
    expect(classifyItausaFootnote("Considera o valor justo contabilizado no Balanço Patrimonial de 30.06.2026.")).toEqual({
      basis: "booked_fair_value", referenceDate: "2026-06-30", parts: null,
    });
  });
});
