import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { B3_UNIVERSE } from "@/data/b3-universe";
import { hasBankAnalysisCache } from "@/lib/banks/bank-coverage";
import { hasInsuranceAnalysisCache } from "@/lib/insurance/insurance-coverage";
import {
  VERIFIED_BANK_IDENTITIES,
  VERIFIED_INSURANCE_IDENTITIES,
  checkRegistryIdentity,
  getVerifiedSectorIdentity,
  resolveSectorCvmCode,
} from "./sector-model-identities";

const ACTIVE_BANKS = ["ITUB4", "BBDC4", "BBAS3", "SANB11", "BPAC11", "BRSR6"];
const ACTIVE_INSURERS = ["BBSE3", "PSSA3", "IRBR3", "CXSE3"];

function cachedCvmCode(dir: string, ticker: string): string | undefined {
  const raw = readFileSync(join(process.cwd(), "src/data", dir, `${ticker}.json`), "utf-8");
  return (JSON.parse(raw) as { company?: { cvmCode?: string } }).company?.cvmCode;
}

describe("verified sector identities — coverage", () => {
  it("every active bank has an explicit verified identity matching its cache", () => {
    expect(Object.keys(VERIFIED_BANK_IDENTITIES).sort()).toEqual([...ACTIVE_BANKS].sort());
    for (const t of ACTIVE_BANKS) {
      expect(hasBankAnalysisCache(t), t).toBe(true);
      const id = VERIFIED_BANK_IDENTITIES[t];
      expect(id.model).toBe("bank");
      expect(id.cvmCode, t).toBe(cachedCvmCode("bank-cache/annual", t));
    }
  });

  it("every active insurer has an explicit verified identity matching its cache", () => {
    expect(Object.keys(VERIFIED_INSURANCE_IDENTITIES).sort()).toEqual([...ACTIVE_INSURERS].sort());
    for (const t of ACTIVE_INSURERS) {
      expect(hasInsuranceAnalysisCache(t), t).toBe(true);
      const id = VERIFIED_INSURANCE_IDENTITIES[t];
      expect(id.model).toBe("insurance");
      expect(id.cvmCode, t).toBe(cachedCvmCode("insurance-cache/annual", t));
    }
  });

  it("identities are well-formed and unique", () => {
    const all = [...Object.values(VERIFIED_BANK_IDENTITIES), ...Object.values(VERIFIED_INSURANCE_IDENTITIES)];
    for (const id of all) {
      expect(id.cvmCode).toMatch(/^[1-9]\d*$/);
      expect(id.cnpj).toMatch(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
      expect(id.legalName.length).toBeGreaterThan(0);
    }
    expect(new Set(all.map(i => i.cvmCode)).size).toBe(all.length);
    expect(new Set(all.map(i => i.cnpj)).size).toBe(all.length);
  });

  it("BRSR6 keeps its former override code 1210", () => {
    expect(getVerifiedSectorIdentity("BRSR6", "bank")?.cvmCode).toBe("1210");
  });

  it("does not add coverage beyond the existing sector caches", () => {
    for (const t of Object.keys(VERIFIED_BANK_IDENTITIES)) expect(hasBankAnalysisCache(t)).toBe(true);
    for (const t of Object.keys(VERIFIED_INSURANCE_IDENTITIES)) expect(hasInsuranceAnalysisCache(t)).toBe(true);
  });
});

describe("SULA11 stays excluded", () => {
  it("has no verified identity and remains unavailable", () => {
    expect(getVerifiedSectorIdentity("SULA11", "insurance")).toBeNull();
    expect(hasInsuranceAnalysisCache("SULA11")).toBe(false);
    expect(B3_UNIVERSE.find(a => a.ticker === "SULA11")?.coverageStatus).toBe("unavailable");
  });

  it("cannot be resolved without the manual fuzzy flag", () => {
    expect(resolveSectorCvmCode("SULA11", "insurance", { allowFuzzyFallback: false, fuzzyMatch: () => "99999" })).toBeNull();
  });
});

describe("resolveSectorCvmCode", () => {
  it("explicit mapping wins and the fuzzy matcher is never consulted", () => {
    const fuzzy = vi.fn(() => "1279"); // e.g. Itaú's cancelled record
    const r = resolveSectorCvmCode("ITUB4", "bank", { allowFuzzyFallback: true, fuzzyMatch: fuzzy });
    expect(r).toMatchObject({ cvmCode: "19348", source: "verified" });
    expect(fuzzy).not.toHaveBeenCalled();
  });

  it("is case-insensitive on the ticker", () => {
    expect(resolveSectorCvmCode("bbse3", "insurance", { allowFuzzyFallback: false, fuzzyMatch: () => null })?.cvmCode).toBe("23159");
  });

  it("does not cross models", () => {
    expect(getVerifiedSectorIdentity("ITUB4", "insurance")).toBeNull();
    expect(getVerifiedSectorIdentity("BBSE3", "bank")).toBeNull();
  });

  it("unknown ticker resolves to null by default", () => {
    const fuzzy = vi.fn(() => "12345");
    expect(resolveSectorCvmCode("XXXX3", "bank", { allowFuzzyFallback: false, fuzzyMatch: fuzzy })).toBeNull();
    expect(fuzzy).not.toHaveBeenCalled();
  });

  it("unknown ticker uses fuzzy only when explicitly allowed, labelled as such", () => {
    expect(resolveSectorCvmCode("XXXX3", "bank", { allowFuzzyFallback: true, fuzzyMatch: () => "12345" }))
      .toEqual({ cvmCode: "12345", source: "fuzzy_fallback" });
    expect(resolveSectorCvmCode("XXXX3", "bank", { allowFuzzyFallback: true, fuzzyMatch: () => null })).toBeNull();
  });
});

describe("checkRegistryIdentity", () => {
  const itau = VERIFIED_BANK_IDENTITIES.ITUB4;

  it("confirms an ATIVO record with the same code and CNPJ (ignoring zero padding/punctuation)", () => {
    expect(checkRegistryIdentity(itau, [
      { cvmCode: "1279", cnpj: "60.872.504/0001-23", status: "CANCELADA" },
      { cvmCode: "019348", cnpj: "60872504000123", status: "ATIVO" },
    ])).toBeNull();
  });

  it("fails when the code is missing, re-assigned or no longer active", () => {
    expect(checkRegistryIdentity(itau, [])).toMatch(/not found/);
    expect(checkRegistryIdentity(itau, [{ cvmCode: "19348", cnpj: "11.111.111/0001-11", status: "ATIVO" }])).toMatch(/expected 60\.872\.504/);
    expect(checkRegistryIdentity(itau, [{ cvmCode: "19348", cnpj: "60.872.504/0001-23", status: "CANCELADA" }])).toMatch(/CANCELADA/);
  });
});
