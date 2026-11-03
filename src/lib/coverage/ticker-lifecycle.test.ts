import { describe, it, expect } from "vitest";
import { B3_UNIVERSE } from "@/data/b3-universe";
import {
  CURATION_EXCLUSIONS,
  TICKER_LIFECYCLE,
  getLifecycleStatus,
  getTickerLifecycle,
  isActiveTicker,
  lifecycleHintPt,
} from "./ticker-lifecycle";
import { searchBadgeFor } from "./search-badge";

const universe = new Map(B3_UNIVERSE.map(a => [a.ticker, a]));

describe("ticker lifecycle — table integrity", () => {
  it("every historical code is in the universe and declared unavailable", () => {
    for (const lc of Object.values(TICKER_LIFECYCLE)) {
      const asset = universe.get(lc.ticker);
      expect(asset, lc.ticker).toBeDefined();
      expect(asset!.coverageStatus, lc.ticker).toBe("unavailable");
      expect(lc.evidence.length, lc.ticker).toBeGreaterThan(20);
    }
  });

  it("every unavailable universe entry has lifecycle metadata", () => {
    for (const a of B3_UNIVERSE.filter(x => x.coverageStatus === "unavailable")) {
      expect(getTickerLifecycle(a.ticker), a.ticker).not.toBeNull();
    }
  });

  it("successors are current codes present in the universe", () => {
    for (const lc of Object.values(TICKER_LIFECYCLE)) {
      if (!lc.successorTicker) continue;
      expect(universe.has(lc.successorTicker), `${lc.ticker} → ${lc.successorTicker}`).toBe(true);
      expect(isActiveTicker(lc.successorTicker), lc.successorTicker).toBe(true);
      expect(lc.successorRelation, lc.ticker).toBeDefined();
    }
  });

  it("effective dates are ISO dates when present", () => {
    for (const lc of Object.values(TICKER_LIFECYCLE)) {
      if (lc.effectiveDate) expect(lc.effectiveDate, lc.ticker).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("ticker lifecycle — verified corporate actions (regression)", () => {
  it.each([
    ["RRRP3", "renamed", "BRAV3", "same_issuer"],
    ["ELET3", "renamed", "AXIA3", "same_issuer"],
    ["ARZZ3", "renamed", "AZZA3", "same_issuer"],
    ["SOMA3", "incorporated", "AZZA3", "new_issuer"],
    ["PETZ3", "incorporated", "AUAU3", "new_issuer"],
    ["VVAR3", "renamed", "BHIA3", "same_issuer"],
    ["EMBR3", "renamed", "EMBJ3", "same_issuer"],
    ["TRPL4", "renamed", "ISAE4", "same_issuer"],
    ["ODPV3", "renamed", "SAUD3", "same_issuer"],
    ["MRFG3", "renamed", "MBRF3", "same_issuer"],
    ["BRFS3", "incorporated", "MBRF3", "new_issuer"],
    ["CPLE6", "converted", "CPLE3", "same_issuer"],
    ["AZUL4", "converted", "AZUL3", "same_issuer"],
    ["NTCO3", "incorporated", "NATU3", "new_issuer"],
    ["JBSS3", "converted", "JBSS32", "new_issuer"],
    ["SULA11", "incorporated", "RDOR3", "new_issuer"],
    ["CESP6", "incorporated", "AURE3", "new_issuer"],
    ["BCFF11", "incorporated", "BTHF11", "new_issuer"],
  ])("%s %s → %s (%s)", (ticker, status, successor, relation) => {
    const lc = getTickerLifecycle(ticker)!;
    expect(lc.status).toBe(status);
    expect(lc.successorTicker).toBe(successor);
    expect(lc.successorRelation).toBe(relation);
  });

  it("ELET6 → AXIA6 → AXIA3 (1.1 AXIA3 per AXIA6, from 2026-06-08), never AXIA7", () => {
    expect(getTickerLifecycle("ELET6")).toMatchObject({
      status: "converted", successorTicker: "AXIA3", successorRelation: "same_issuer",
      intermediateTickers: ["AXIA6"], conversionRatio: "1.1 AXIA3 per AXIA6", effectiveDate: "2026-06-08", verification: "verified",
    });
  });

  it.each([
    ["TRPL4", "2024-11-18"], ["ODPV3", "2026-05-05"], ["EMBR3", "2025-11-03"],
    ["CESP6", "2022-03-28"], ["ENBR3", "2023-07-11"], ["NTCO3", "2025-07-01"],
  ])("%s effective date %s", (ticker, date) => {
    expect(getTickerLifecycle(ticker)!.effectiveDate).toBe(date);
  });

  it.each(["ENBR3", "STBP3", "GOLL4", "CRFB3", "BRPR3"])("%s has no B3 successor", ticker => {
    expect(getTickerLifecycle(ticker)!.successorTicker).toBeUndefined();
    expect(isActiveTicker(ticker)).toBe(false);
  });

  it("does not link transitional codes as successors (AXIA6, AXIA7, AZUL53/AZUL54)", () => {
    const successors = Object.values(TICKER_LIFECYCLE).map(l => l.successorTicker);
    for (const code of ["AXIA6", "AXIA7", "AZUL53", "AZUL54", "VIIA3"]) expect(successors).not.toContain(code);
  });

  it("every lifecycle link is verified against official B3/CVM evidence", () => {
    for (const lc of Object.values(TICKER_LIFECYCLE)) expect(lc.verification, lc.ticker).toBe("verified");
    expect(getTickerLifecycle("CESP6")!.successorTicker).toBe("AURE3");
    expect(getTickerLifecycle("BCFF11")!.successorTicker).toBe("BTHF11");
  });
});

describe("Alphabet BDRs", () => {
  it("GOGL34 and GOGL35 are current informational assets; GOOGL34 is not a listed B3 security", () => {
    for (const t of ["GOGL34", "GOGL35"]) {
      const asset = universe.get(t);
      expect(asset?.assetType, t).toBe("bdr");
      expect(isActiveTicker(t)).toBe(true);
    }
    expect(universe.has("GOOGL34")).toBe(false);
    expect(getTickerLifecycle("GOOGL34")).toBeNull();
  });
});

describe("curation exclusions", () => {
  it("AXIA7 is excluded by policy, recorded explicitly, and absent from the universe", () => {
    const ex = CURATION_EXCLUSIONS.find(e => e.ticker === "AXIA7")!;
    expect(ex.issuerTicker).toBe("AXIA3");
    expect(universe.has("AXIA7")).toBe(false);
    for (const e of CURATION_EXCLUSIONS) {
      expect(universe.has(e.ticker), e.ticker).toBe(false);
      expect(universe.has(e.issuerTicker), e.issuerTicker).toBe(true);
    }
  });
});

describe("active tickers", () => {
  it("have no lifecycle entry and no successor", () => {
    for (const t of ["WEGE3", "ITUB4", "BRAV3", "AXIA3", "AUAU3", "BTHF11"]) {
      expect(getTickerLifecycle(t), t).toBeNull();
      expect(getLifecycleStatus(t)).toBe("active");
      expect(lifecycleHintPt(t)).toBeNull();
    }
  });
});

describe("lifecycle-aware search hint", () => {
  it("names the current code for historical tickers instead of a coverage badge", () => {
    expect(lifecycleHintPt("RRRP3")).toBe("Código histórico · Atual: BRAV3");
    expect(lifecycleHintPt("GOLL4")).toBe("Código histórico · Registro cancelado");
    expect(searchBadgeFor({ ticker: "PETZ3", coverageStatus: "unavailable" }).label).toBe("Código histórico · Atual: AUAU3");
    expect(searchBadgeFor({ ticker: "WEGE3", coverageStatus: "full_analysis" }).label).toBe("Análise completa");
  });
});
