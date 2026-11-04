import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HoldingAnalysisPanel from "./HoldingAnalysisPanel";
import { buildHoldingAnalysisResponse } from "@/lib/holdings/holding-analysis";
import { readHoldingCache } from "@/lib/holdings/holding-cache";
import type { HoldingCache } from "@/lib/holdings/holding-types";

const html = (ticker: string, cache: HoldingCache | null = readHoldingCache(ticker), variant: "dashboard" | "report" = "dashboard") =>
  renderToStaticMarkup(<HoldingAnalysisPanel data={buildHoldingAnalysisResponse(ticker, cache)} variant={variant} />);
const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");

describe("HoldingAnalysisPanel — Itaúsa", () => {
  const markup = html("ITSA3");
  const t = text(markup);

  it("renders the information architecture with semantic headings", () => {
    const headings = [...markup.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map(m => m[1]);
    expect(headings).toEqual([
      "Visão geral da holding", "Composição do portfólio", "Posição financeira da holding",
      "Geração de caixa e despesas da holding", "Classes de ações e emissora", "Datas, fontes e metodologia",
    ]);
  });

  it("headline metrics with official values and dates", () => {
    expect(t).toContain("Valor do portfólio R$ 199,95 bi");
    expect(t).toContain("Valor de mercado oficial R$ 163,63 bi");
    expect(t).toContain("Desconto oficial −18,2%");
    expect(t).toContain("Maior investida 91,0% Itaú Unibanco");
    expect(t).toContain("Caixa da holding R$ 2,19 bi");
    expect(t).toContain("Dívida líquida R$ 1,18 bi");
    expect(t).toContain("Dividendos/JCP recebidos R$ 12,50 bi");
  });

  it("lists every investee with value basis; Demais Ativos e Passivos only as reconciliation", () => {
    for (const name of ["Itaú Unibanco", "Dexco", "Alpargatas", "Motiva", "Aegea", "Copa Energia", "NTS"]) expect(t).toContain(name);
    expect(t).toContain("Demais Ativos e Passivos Reconciliação — não é investida");
    expect(t).toContain("Valor justo contabilizado");
    expect(t).toContain("Base mista (transação + contábil)");
    const chart = markup.match(/role="img" aria-label="([^"]+)"/)![1];
    expect(chart).toContain("Itaú Unibanco 91,0%");
    expect(chart).not.toContain("Demais");
  });

  it("states that the fundamentals are issuer-wide and highlights the requested class", () => {
    expect(t).toContain("Ticker consultado: ITSA3 (ON)");
    expect(t).toContain("valem igualmente para ITSA3 e ITSA4; a cotação de mercado é específica de ITSA3");
    expect(markup).toMatch(/<li aria-current="true"[^>]*>.*?ITSA3/);
    expect(markup.match(/aria-current="true"/g)).toHaveLength(1);
  });

  it("NTS is excluded from holding cash", () => {
    expect(t).toContain("Não inclui R$ 1,51 bi em aplicações financeiras (participação do portfólio)");
  });
});

describe("HoldingAnalysisPanel — Bradespar", () => {
  const t = text(html("BRAP3"));

  it("renders Vale, the published share quantity, price, ownership caveat and NAV", () => {
    expect(t).toContain("Ações de Vale detidas 163.354.595");
    expect(t).toContain("Preço de referência VALE3 R$ 62,02");
    expect(t).toContain("Participação publicada 3,84%¹");
    expect(t).toContain("Valor da participação R$ 10.131,3 mi");
    expect(t).toContain("Valor do portfólio (NAV oficial) R$ 10.642,3 mi");
    expect(t).toMatch(/¹ A participação de 3,84% em Vale é exibida como publicada/);
  });

  it("keeps statement net debt (30/06) and bulletin net cash (30/10) distinct", () => {
    expect(t).toContain("Caixa líquido publicado R$ 511,0 mi Boletim · 30/10/2026");
    expect(t).toContain("Dívida líquida −R$ 254,5 mi Negativa = caixa líquido · 30/06/2026");
    expect(t).toContain("Caixa líquido publicado no boletim: R$ 511,0 mi (referência 30/10/2026). Compõe o valor do portfólio oficial e não substitui a posição da demonstração individual de 30/06/2026");
  });

  it("official market value is the per-class sum", () => {
    expect(t).toContain("Soma por classe: preço de fechamento × ações da classe ex-tesouraria");
    expect(t).toContain("BRAP3 R$ 17,06 137.989.898");
    expect(t).toContain("BRAP4 R$ 18,27 255.106.712");
    expect(t).toContain('Desconto oficial −34,1% Publicado pela companhia como "34,1%"');
  });

  it("debt ratios of a holding without borrowings are not applicable, never zero", () => {
    expect(t).toContain("Dívida bruta ÷ dividendos recebidos Não aplicável Não aplicável: sem empréstimos e financiamentos");
    expect(t).toContain("Dividendos recebidos ÷ despesas financeiras Não aplicável");
  });
});

describe("HoldingAnalysisPanel — wording and nulls", () => {
  it("descriptive labels only: no valuation wording, no industrial metrics", () => {
    for (const ticker of ["ITSA4", "BRAP4"]) {
      const t = text(html(ticker)).toLowerCase();
      for (const word of ["upside", "potencial", "oportunidade", "barat", "atrativ", "comprar", "vender", "wacc", "dcf"]) {
        expect(t, `${ticker}: ${word}`).not.toContain(word);
      }
      for (const label of ["ebit", "margem", "receita", "fcl", "p/l", "roe", "capex"]) {
        expect(t, `${ticker}: ${label}`).not.toContain(label);
      }
      expect(t).toContain("é descritivo: não indica valor justo, preço-alvo nem retorno esperado");
    }
  });

  it("null values render as N/D, never as zero", () => {
    const cache = structuredClone(readHoldingCache("ITSA4")!);
    cache.indicators.core.dividendsReceivedTtm.value = null;
    cache.indicators.core.holdingCash.value = null;
    const t = text(html("ITSA4", cache));
    expect(t).toContain("Caixa da holding N/D");
    expect(t).toContain("Dividendos/JCP recebidos N/D");
    expect(t).not.toContain("Caixa da holding R$ 0");
  });

  it("limited cache shows a restrained warning; missing cache shows the holding unavailable state", () => {
    const stale = structuredClone(readHoldingCache("BRAP4")!);
    stale.enrichment = { statements: "ok", portfolio: "preserved", issues: [] };
    const limited = text(html("BRAP4", stale));
    expect(limited).toContain("Análise limitada");
    expect(limited).toContain("é exibido o último retrato validado (referência 30/10/2026)");

    const missing = text(html("ITSA3", null));
    expect(missing).toContain("Dados do modelo de holdings ainda não disponíveis");
    expect(missing).toContain("não utiliza o modelo industrial");
  });

  it("report variant renders the same sections", () => {
    const report = html("ITSA4", readHoldingCache("ITSA4"), "report");
    expect(report.match(/<h2/g)).toHaveLength(6);
    expect(report).toContain('class="report-section"');
  });
});
