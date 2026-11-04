import { describe, expect, it } from "vitest";
import { checkRegistryIdentity } from "../cvm/sector-model-identities";
import {
  B3SA3_IDENTITY,
  CURRENT_SEGMENT_TAXONOMY,
  VERIFIED_MARKET_INFRASTRUCTURE_IDENTITIES,
  getMarketInfrastructureIdentity,
  matchesAny,
} from "./market-infrastructure-identity";

describe("B3SA3 market-infrastructure identity", () => {
  it("B3SA3 → CVM 21610, CNPJ, ISIN, one ON share class", () => {
    expect(getMarketInfrastructureIdentity("b3sa3")).toBe(B3SA3_IDENTITY);
    expect(B3SA3_IDENTITY).toMatchObject({
      ticker: "B3SA3",
      cvmCode: "21610",
      cnpj: "09.346.601/0001-25",
      legalName: "B3 S.A. - BRASIL, BOLSA, BALCÃO",
      tradingName: "B3",
      registration: "ATIVO, Categoria A",
      isin: "BRB3SAACNOR6",
      shareClassKind: "ON",
    });
    const a = B3SA3_IDENTITY.shareCountAnchor;
    expect(a).toEqual({ referenceDate: "2026-06-30", issued: 5_046_500_000, treasury: 48_201_452, outstanding: 4_998_298_548 });
    expect(a.issued - a.treasury).toBe(a.outstanding);
  });

  it("supports B3SA3 only — no sector-name inference", () => {
    expect(Object.keys(VERIFIED_MARKET_INFRASTRUCTURE_IDENTITIES)).toEqual(["B3SA3"]);
    for (const other of ["B3SA4", "CIEL3", "ALOS3", "MULT3", "IGTI11", "JHSF3", "ITSA4", "ITUB4"]) {
      expect(getMarketInfrastructureIdentity(other)).toBeNull();
    }
  });

  it("validates against a CVM registry record (CD_CVM + CNPJ + ATIVO)", () => {
    const record = { cvmCode: "021610", cnpj: "09.346.601/0001-25", status: "ATIVO" };
    expect(checkRegistryIdentity(B3SA3_IDENTITY, [record])).toBeNull();
    expect(checkRegistryIdentity(B3SA3_IDENTITY, [{ ...record, status: "CANCELADA" }])).toMatch(/ATIVO/);
    expect(checkRegistryIdentity(B3SA3_IDENTITY, [{ ...record, cnpj: "00.000.000/0001-91" }])).toMatch(/CNPJ/);
    expect(checkRegistryIdentity(B3SA3_IDENTITY, [])).toMatch(/not found/);
  });

  it("segment label variants are exact (no fuzzy match)", () => {
    const tp = CURRENT_SEGMENT_TAXONOMY.find(d => d.id === "tecnologia_e_plataformas")!;
    expect(matchesAny(tp.labels, "Tecnologia & Serviços")).toBe(true);
    expect(matchesAny(tp.labels, "Tecnologia & Plataformas")).toBe(true);
    expect(matchesAny(tp.labels, "Tecnologia")).toBe(false);
    const sad = CURRENT_SEGMENT_TAXONOMY.find(d => d.id === "solucoes_analiticas_de_dados")!;
    expect(matchesAny(sad.labels, "Soluções Analíticas de Dados (Trillia)")).toBe(true);
    expect(matchesAny(sad.labels, "Trillia")).toBe(false);
  });
});
