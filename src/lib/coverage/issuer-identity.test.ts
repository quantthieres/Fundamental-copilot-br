import { describe, it, expect } from "vitest";
import { B3_UNIVERSE } from "@/data/b3-universe";
import { getCvmCompanyByTicker } from "@/lib/cvm/company-map";
import { VERIFIED_BANK_IDENTITIES, VERIFIED_INSURANCE_IDENTITIES } from "@/lib/cvm/sector-model-identities";
import { ISSUER_CVM_CODE, getIssuerKey, isSameIssuer } from "./issuer-identity";

describe("issuer identity", () => {
  it("covers every company ticker in the universe (funds, ETFs and BDRs excepted)", () => {
    for (const a of B3_UNIVERSE) {
      if (a.assetType === "fii" || a.assetType === "etf" || (a.assetType === "bdr" && a.ticker !== "JBSS32")) continue;
      expect(ISSUER_CVM_CODE[a.ticker], a.ticker).toMatch(/^\d+$/);
    }
  });

  it("agrees with company-map.ts (the documented NTCO3 case aside)", () => {
    for (const [ticker, code] of Object.entries(ISSUER_CVM_CODE)) {
      const mapped = getCvmCompanyByTicker(ticker)?.cvmCode;
      if (!mapped) continue;
      // NTCO3's cache is mapped to Natura Cosméticos (19550, NATU3's issuer);
      // the NTCO3 trading code itself belonged to Natura &Co Holding (24783).
      if (ticker === "NTCO3") { expect([mapped, code]).toEqual(["19550", "24783"]); continue; }
      expect(mapped, ticker).toBe(code);
    }
  });

  it("agrees with the verified bank and insurance identities", () => {
    for (const id of [...Object.values(VERIFIED_BANK_IDENTITIES), ...Object.values(VERIFIED_INSURANCE_IDENTITIES)]) {
      expect(ISSUER_CVM_CODE[id.ticker], id.ticker).toBe(id.cvmCode);
    }
  });

  it("groups share classes and successor codes of the same issuer", () => {
    expect(isSameIssuer("ITUB3", "ITUB4")).toBe(true);
    expect(isSameIssuer("BBDC3", "BBDC4")).toBe(true);
    expect(isSameIssuer("ITSA3", "ITSA4")).toBe(true);
    expect(isSameIssuer("PETR3", "PETR4")).toBe(true);
    expect(isSameIssuer("ELET3", "AXIA3")).toBe(true);
    expect(isSameIssuer("GOGL34", "GOGL35")).toBe(true);
  });

  it("keeps different issuers apart", () => {
    expect(isSameIssuer("ITSA4", "ITUB4")).toBe(false);
    expect(isSameIssuer("PETZ3", "AUAU3")).toBe(false); // incorporation, new CNPJ
    expect(isSameIssuer("GOAU4", "GGBR4")).toBe(false); // holding vs operating company
  });

  it("uses ticker keys for funds without a CVM company code", () => {
    expect(getIssuerKey("MXRF11")).toBe("ticker:MXRF11");
    expect(getIssuerKey("ITUB4")).toBe("cvm:19348");
  });
});
