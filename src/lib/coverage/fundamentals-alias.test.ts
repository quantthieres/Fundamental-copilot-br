import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import { B3_UNIVERSE } from "@/data/b3-universe";
import { getCvmCompanyByTicker } from "@/lib/cvm/company-map";
import { VERIFIED_BANK_IDENTITIES, VERIFIED_INSURANCE_IDENTITIES } from "@/lib/cvm/sector-model-identities";
import {
  FUNDAMENTALS_ALIASES,
  fundamentalsAliasMeta,
  getFundamentalsAlias,
  resolveFundamentalsTicker,
  withRequestedTicker,
} from "./fundamentals-alias";
import { getIssuerCvmCode, isSameIssuer } from "./issuer-identity";
import { getTickerLifecycle } from "./ticker-lifecycle";

describe("bank share-class aliases", () => {
  it("ITUB3 → ITUB4 and ITUB4 → ITUB4", () => {
    expect(resolveFundamentalsTicker("ITUB3")).toBe("ITUB4");
    expect(resolveFundamentalsTicker("itub3")).toBe("ITUB4");
    expect(resolveFundamentalsTicker("ITUB4")).toBe("ITUB4");
    expect(getFundamentalsAlias("ITUB3")?.reason).toBe("same_issuer_share_class");
  });

  it("BBDC3 → BBDC4 and BBDC4 → BBDC4", () => {
    expect(resolveFundamentalsTicker("BBDC3")).toBe("BBDC4");
    expect(resolveFundamentalsTicker("BBDC4")).toBe("BBDC4");
  });

  it("Itaúsa is never aliased to Itaú Unibanco", () => {
    for (const t of ["ITSA3", "ITSA4"]) {
      expect(resolveFundamentalsTicker(t)).toBe(t);
      expect(getFundamentalsAlias(t)).toBeNull();
      expect(isSameIssuer(t, "ITUB4")).toBe(false);
    }
    expect(isSameIssuer("ITSA3", "ITSA4")).toBe(true);
  });

  it("unknown and non-aliased tickers resolve to themselves", () => {
    expect(resolveFundamentalsTicker("WEGE3")).toBe("WEGE3");
    expect(resolveFundamentalsTicker("XXXX3")).toBe("XXXX3");
    expect(fundamentalsAliasMeta("WEGE3")).toBeNull();
  });
});

function cacheCvmCode(ticker: string): string | null {
  return getCvmCompanyByTicker(ticker)?.cvmCode
    ?? VERIFIED_BANK_IDENTITIES[ticker]?.cvmCode
    ?? VERIFIED_INSURANCE_IDENTITIES[ticker]?.cvmCode
    ?? null;
}

describe("alias integrity", () => {
  const universe = new Set(B3_UNIVERSE.map(a => a.ticker));

  it("every alias points at a cache built from the same CVM entity", () => {
    for (const a of Object.values(FUNDAMENTALS_ALIASES)) {
      const issuer = getIssuerCvmCode(a.ticker);
      expect(issuer, a.ticker).not.toBeNull();
      expect(cacheCvmCode(a.fundamentalsTicker), `${a.ticker} → ${a.fundamentalsTicker}`).toBe(issuer);
    }
  });

  it("every alias target has a model cache on disk", () => {
    const dirs = ["cvm-cache/financials", "bank-cache/annual", "insurance-cache/annual", "fii-cache/monthly"];
    for (const a of Object.values(FUNDAMENTALS_ALIASES)) {
      const found = dirs.some(d => existsSync(join(process.cwd(), "src/data", d, `${a.fundamentalsTicker}.json`)));
      expect(found, a.fundamentalsTicker).toBe(true);
    }
  });

  it("aliases are current universe tickers, not chains, never historical", () => {
    for (const a of Object.values(FUNDAMENTALS_ALIASES)) {
      expect(universe.has(a.ticker), a.ticker).toBe(true);
      expect(FUNDAMENTALS_ALIASES[a.fundamentalsTicker], a.fundamentalsTicker).toBeUndefined();
      expect(getTickerLifecycle(a.ticker), a.ticker).toBeNull();
    }
  });

  it("ticker-change and issuer-transition aliases point at the predecessor named in the lifecycle table", () => {
    for (const a of Object.values(FUNDAMENTALS_ALIASES)) {
      if (a.reason === "same_issuer_share_class") continue;
      expect(getTickerLifecycle(a.fundamentalsTicker)?.successorTicker, a.ticker).toBe(a.ticker);
    }
  });

  it("same-issuer ticker changes keep the issuer; the NATU3 transition does not", () => {
    for (const a of Object.values(FUNDAMENTALS_ALIASES)) {
      if (a.reason === "same_issuer_ticker_change" || a.reason === "same_issuer_share_class") {
        expect(getIssuerCvmCode(a.fundamentalsTicker), a.ticker).toBe(getIssuerCvmCode(a.ticker));
      }
    }
  });
});

describe("NATU3 / NTCO3 issuer transition (special case)", () => {
  it("is labelled as an incorporation, not a rename", () => {
    expect(getFundamentalsAlias("NATU3")?.reason).toBe("issuer_transition_cache_from_current_issuer");
    const lc = getTickerLifecycle("NTCO3")!;
    expect(lc).toMatchObject({ status: "incorporated", successorTicker: "NATU3", successorRelation: "new_issuer", effectiveDate: "2025-07-01" });
  });

  it("is safe only because the NTCO3 cache is sourced from NATU3's issuer (CVM 19550)", () => {
    expect(getIssuerCvmCode("NTCO3")).toBe("24783");   // former holding
    expect(getIssuerCvmCode("NATU3")).toBe("19550");   // current issuer
    expect(getCvmCompanyByTicker("NTCO3")?.cvmCode).toBe("19550"); // cache source
    expect(isSameIssuer("NATU3", "NTCO3")).toBe(false);
  });
});

describe("withRequestedTicker", () => {
  const cached = {
    ticker: "ITUB4",
    available: true,
    company: { ticker: "ITUB4", companyName: "Itaú Unibanco Holding S.A.", cvmCode: "19348" },
    indicators: { roe: 0.2 },
  };

  it("keeps the requested ticker and records the alias, without touching the data", () => {
    const out = withRequestedTicker(cached, "ITUB3") as typeof cached & { fundamentalsAlias: unknown };
    expect(out.ticker).toBe("ITUB3");
    expect(out.company).toEqual({ ...cached.company, ticker: "ITUB3" });
    expect(out.indicators).toBe(cached.indicators);
    expect(out.fundamentalsAlias).toEqual({ requestedTicker: "ITUB3", fundamentalsTicker: "ITUB4", reason: "same_issuer_share_class" });
    expect(cached.ticker).toBe("ITUB4"); // input not mutated
  });

  it("returns non-aliased responses unchanged", () => {
    expect(withRequestedTicker(cached, "ITUB4")).toBe(cached);
  });
});
