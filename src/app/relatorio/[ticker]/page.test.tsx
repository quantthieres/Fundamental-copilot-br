import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ReportPage from "./page";

// The only network call of the report page is the brapi quote of the requested
// ticker — stubbed here. Holding data comes from the committed cache.
const PRICES: Record<string, number> = { ITSA3: 13.11, ITSA4: 14.6, BRAP3: 17.06, BRAP4: 18.27 };

async function render(ticker: string) {
  const urls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    urls.push(url);
    const symbol = decodeURIComponent(new URL(url).pathname.split("/").pop()!);
    return new Response(JSON.stringify({ results: [{ symbol, regularMarketPrice: PRICES[symbol] }] }), { status: 200 });
  }));
  const element = await ReportPage({ params: Promise.resolve({ ticker }), searchParams: Promise.resolve({}) });
  const text = renderToStaticMarkup(element).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  return { text, urls };
}

describe("report route — holding share classes", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ["ITSA3", "Itaúsa S.A.", "R$ 199,95 bi"],
    ["ITSA4", "Itaúsa S.A.", "R$ 199,95 bi"],
    ["BRAP3", "Bradespar S.A.", "R$ 10,64 bi"],
    ["BRAP4", "Bradespar S.A.", "R$ 10,64 bi"],
  ])("%s renders the holding report from the issuer cache", async (ticker, company, portfolio) => {
    const { text, urls } = await render(ticker);
    expect(text).toContain(`Modelo de Holding · Uso educacional`);
    expect(text).toContain(`${company} (${ticker})`);
    expect(text).toContain(`Valor do portfólio ${portfolio}`);
    expect(text).toContain(`Ticker consultado: ${ticker}`);
    // Not the industrial / quote-only / bank reports.
    for (const other of ["Modelo Industrial", "Dados limitados", "Cobertura parcial", "Modelo Bancário", "Histórico financeiro"]) {
      expect(text, other).not.toContain(other);
    }
    // The quote is the requested share class's own (never the canonical class).
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain(`/quote/${ticker}`);
    expect(text).toContain(`Cotação R$ ${PRICES[ticker].toFixed(2).replace(".", ",")}`);
  });
});
