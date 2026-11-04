import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MetodologiaPage from "./page";
import CoberturaPage from "../cobertura/page";

const text = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/\s+/g, " ");

describe("methodology page — holding model", () => {
  const t = text(renderToStaticMarkup(<MetodologiaPage />));

  it("has a discoverable holding section", () => {
    expect(t).toContain("G · Holdings");
    expect(t).toContain("Modelo de holdings");
    expect(t).toContain("Holdings (Itaúsa, Bradespar) → modelo de holdings");
  });

  it("explains parent-only statements, SOTP, official discount, value bases, dates and share classes", () => {
    for (const s of [
      "Demonstrações individuais (controladora), não consolidadas",
      "Portfólio como soma das partes",
      "Desconto oficial: valor de mercado oficial ÷ valor do portfólio − 1",
      "Bases de mensuração mistas",
      "Itaúsa: portfólio da página",
      "Bradespar: Boletim Quinzenal",
      "Datas distintas não são combinadas",
      "a cotação é sempre a do ticker consultado",
    ]) expect(t).toContain(s);
  });

  it("stays descriptive", () => {
    expect(t).toContain("O modelo de holdings é descritivo");
  });
});

describe("coverage page — holdings", () => {
  const t = text(renderToStaticMarkup(<CoberturaPage />));

  it("shows the holding model card and no implementation jargon", () => {
    expect(t).toContain("Modelo de Holding 4");
    expect(t).not.toContain("sector_specific");
    expect(t).not.toContain("model_pending");
  });

  it("lists ITSA3, ITSA4, BRAP3 and BRAP4 under the holding model (BRAP no longer quote-only)", () => {
    for (const [ticker, name] of [["ITSA4", "Itaúsa Itaúsa S.A."], ["ITSA3", "Itaúsa ON Itaúsa S.A."], ["BRAP4", "Bradespar Bradespar S.A."], ["BRAP3", "Bradespar ON Bradespar S.A."]]) {
      expect(t, ticker).toContain(`${ticker} ${name} Holding Modelo de Holding Modelo de holdings disponível`);
    }
  });
});
