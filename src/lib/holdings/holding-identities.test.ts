import { describe, expect, it } from "vitest";
import { B3_UNIVERSE } from "@/data/b3-universe";
import { ISSUER_CVM_CODE, isSameIssuer } from "@/lib/coverage/issuer-identity";
import { resolveFundamentalsTicker } from "@/lib/coverage/fundamentals-alias";
import { VERIFIED_BANK_IDENTITIES } from "@/lib/cvm/sector-model-identities";
import {
  HOLDING_CACHE_ALIASES,
  VERIFIED_HOLDING_IDENTITIES,
  descriptionMatches,
  getHoldingIdentity,
  isHoldingIssuerTicker,
  resolveHoldingCacheTicker,
} from "./holding-identities";

describe("holding identities", () => {
  it("Itaúsa: CVM 7617, CNPJ 61.532.644/0001-15, ITSA3 ON + ITSA4 PN", () => {
    expect(VERIFIED_HOLDING_IDENTITIES.ITSA4).toMatchObject({ cvmCode: "7617", cnpj: "61.532.644/0001-15", legalName: "ITAUSA S.A." });
    expect(VERIFIED_HOLDING_IDENTITIES.ITSA4.shareClasses).toEqual([
      { ticker: "ITSA3", kind: "ON", isin: "BRITSAACNOR0" },
      { ticker: "ITSA4", kind: "PN", isin: "BRITSAACNPR7" },
    ]);
  });

  it("Bradespar: CVM 18724, CNPJ 03.847.461/0001-92, BRAP3 ON + BRAP4 PN", () => {
    expect(VERIFIED_HOLDING_IDENTITIES.BRAP4).toMatchObject({ cvmCode: "18724", cnpj: "03.847.461/0001-92", legalName: "BRADESPAR S/A" });
    expect(VERIFIED_HOLDING_IDENTITIES.BRAP4.shareClasses.map(c => [c.ticker, c.kind, c.isin])).toEqual([
      ["BRAP3", "ON", "BRBRAPACNOR5"],
      ["BRAP4", "PN", "BRBRAPACNPR2"],
    ]);
  });

  it("share classes of one issuer resolve to the same canonical cache", () => {
    expect(resolveHoldingCacheTicker("ITSA3")).toBe("ITSA4");
    expect(resolveHoldingCacheTicker("itsa4")).toBe("ITSA4");
    expect(resolveHoldingCacheTicker("BRAP3")).toBe("BRAP4");
    expect(resolveHoldingCacheTicker("BRAP4")).toBe("BRAP4");
    expect(getHoldingIdentity("BRAP3")).toBe(VERIFIED_HOLDING_IDENTITIES.BRAP4);
    expect(isSameIssuer("ITSA3", "ITSA4")).toBe(true);
    expect(isSameIssuer("BRAP3", "BRAP4")).toBe(true);
  });

  it("Itaúsa is never aliased to Itaú Unibanco (or any investee)", () => {
    for (const t of ["ITUB3", "ITUB4", "VALE3", "DXCO3", "ALPA4", "MOTV3"]) {
      expect(resolveHoldingCacheTicker(t), t).toBeNull();
      expect(isHoldingIssuerTicker(t), t).toBe(false);
    }
    expect(VERIFIED_HOLDING_IDENTITIES.ITSA4.cvmCode).not.toBe(VERIFIED_BANK_IDENTITIES.ITUB4.cvmCode);
    expect(isSameIssuer("ITSA4", "ITUB4")).toBe(false);
    expect(Object.values(HOLDING_CACHE_ALIASES)).not.toContain("ITUB4");
  });

  it("holding aliases are not generic fundamentals aliases (no market-price aliasing)", () => {
    for (const t of ["ITSA3", "BRAP3"]) expect(resolveFundamentalsTicker(t)).toBe(t);
  });

  it("agrees with issuer-identity.ts and the curated universe", () => {
    for (const id of Object.values(VERIFIED_HOLDING_IDENTITIES)) {
      for (const sc of id.shareClasses) {
        expect(ISSUER_CVM_CODE[sc.ticker], sc.ticker).toBe(id.cvmCode);
        expect(B3_UNIVERSE.some(a => a.ticker === sc.ticker), sc.ticker).toBe(true);
      }
    }
  });

  it("CSAN3 and GOAU4 stay outside the holding model", () => {
    expect(isHoldingIssuerTicker("CSAN3")).toBe(false);
    expect(isHoldingIssuerTicker("GOAU4")).toBe(false);
  });

  it("verified dividend descriptions (official rows) normalize accents, case and connectives", () => {
    const brap = VERIFIED_HOLDING_IDENTITIES.BRAP4.accounts.dividendsReceived;
    expect(descriptionMatches(brap, "Juros sobre o Capital Próprio e Dividendos Recebidos")).toBe(true);
    expect(descriptionMatches(brap, "Juros sobre Capital Próprio e Dividendos Recebidos")).toBe(true);
    expect(descriptionMatches(brap, "Juros sobre o Capital Próprio e Dividendos Pagos")).toBe(false);
    const itsa = VERIFIED_HOLDING_IDENTITIES.ITSA4.accounts.dividendsReceived;
    expect(itsa.code).toBe("6.02.07");
    expect(descriptionMatches(itsa, "Juros sobre o capital próprio e Dividendos recebidos")).toBe(true);
    expect(descriptionMatches(itsa, "Juros sobre o capital próprio e Dividendos pagos")).toBe(false);
  });
});
