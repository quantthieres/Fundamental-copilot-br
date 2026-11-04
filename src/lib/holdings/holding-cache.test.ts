import { describe, expect, it } from "vitest";
import { readHoldingCache, serializeHoldingCache } from "./holding-cache";
import { hasHoldingAnalysisCache } from "./holding-coverage";
import { VERIFIED_HOLDING_IDENTITIES } from "./holding-identities";

// Reads the committed caches in src/data/holding-cache/.
describe("committed holding caches", () => {
  it("ITSA3 resolves the ITSA4 issuer cache", () => {
    const on = readHoldingCache("ITSA3");
    expect(on?.ticker).toBe("ITSA4");
    expect(on).toEqual(readHoldingCache("ITSA4"));
    expect(on?.issuer).toMatchObject({ cvmCode: "7617", cnpj: "61.532.644/0001-15", statementBasis: "individual" });
  });

  it("BRAP3 resolves the BRAP4 issuer cache", () => {
    const on = readHoldingCache("BRAP3");
    expect(on?.ticker).toBe("BRAP4");
    expect(on?.issuer).toMatchObject({ cvmCode: "18724", cnpj: "03.847.461/0001-92" });
  });

  it("each issuer cache carries both share classes", () => {
    expect(readHoldingCache("ITSA4")!.shareClasses.map(c => c.ticker)).toEqual(["ITSA3", "ITSA4"]);
    expect(readHoldingCache("BRAP4")!.shareClasses.map(c => c.ticker)).toEqual(["BRAP3", "BRAP4"]);
  });

  it("no other ticker reads a holding cache (Itaú Unibanco is not Itaúsa)", () => {
    for (const t of ["ITUB4", "ITUB3", "VALE3", "BBDC4"]) {
      expect(readHoldingCache(t), t).toBeNull();
      expect(hasHoldingAnalysisCache(t), t).toBe(false);
    }
  });

  it("every cached issuer is registered and validated", () => {
    for (const ticker of Object.keys(VERIFIED_HOLDING_IDENTITIES)) {
      const cache = readHoldingCache(ticker)!;
      expect(hasHoldingAnalysisCache(ticker)).toBe(true);
      expect(cache.statements.every(s => s.basis === "individual")).toBe(true);
      expect(cache.portfolio?.validation.status).toBe("passed");
    }
  });

  it("serialization is stable", () => {
    const cache = readHoldingCache("BRAP4")!;
    expect(serializeHoldingCache(JSON.parse(serializeHoldingCache(cache)))).toBe(serializeHoldingCache(cache));
  });
});
