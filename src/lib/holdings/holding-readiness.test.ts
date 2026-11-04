import { describe, expect, it } from "vitest";
import { readHoldingCache } from "./holding-cache";
import { assessHoldingCache } from "./holding-readiness";
import type { HoldingCache } from "./holding-types";

const committed = (t: string) => readHoldingCache(t)!;
const clone = (c: HoldingCache): HoldingCache => structuredClone(c);

describe("assessHoldingCache — committed caches", () => {
  it("ITSA3/ITSA4 and BRAP3/BRAP4 resolve the same issuer cache and are ready", () => {
    for (const [on, pn] of [["ITSA3", "ITSA4"], ["BRAP3", "BRAP4"]]) {
      expect(readHoldingCache(on)!.ticker).toBe(pn);
      expect(assessHoldingCache(on, readHoldingCache(on))).toEqual({ status: "ready", canonicalTicker: pn, reasons: [] });
      expect(assessHoldingCache(pn, readHoldingCache(pn))).toEqual({ status: "ready", canonicalTicker: pn, reasons: [] });
    }
  });
});

describe("assessHoldingCache — limited (usable, nonfatal gap)", () => {
  it("stale portfolio", () => {
    const c = clone(committed("ITSA4"));
    c.portfolioFreshness = { ...c.portfolioFreshness, status: "stale", quarterLag: 2 };
    expect(assessHoldingCache("ITSA3", c)).toMatchObject({ status: "limited", reasons: [expect.stringMatching(/portfolio stale/)] });
  });

  it("preserved portfolio or statements", () => {
    const c = clone(committed("BRAP4"));
    c.enrichment = { statements: "ok", portfolio: "preserved", issues: [] };
    expect(assessHoldingCache("BRAP3", c)).toMatchObject({ status: "limited", reasons: ["portfolio enrichment preserved"] });
    c.enrichment = { statements: "preserved", portfolio: "ok", issues: [] };
    expect(assessHoldingCache("BRAP4", c).status).toBe("limited");
  });

  it("missing portfolio, failed validation, missing core account or share counts", () => {
    const noPortfolio = clone(committed("ITSA4"));
    noPortfolio.portfolio = null;
    expect(assessHoldingCache("ITSA4", noPortfolio)).toMatchObject({ status: "limited", reasons: ["no portfolio snapshot"] });

    const failed = clone(committed("ITSA4"));
    failed.portfolio!.validation.status = "failed";
    expect(assessHoldingCache("ITSA4", failed).reasons).toContain("portfolio arithmetic validation not passed");

    const noCash = clone(committed("BRAP4"));
    noCash.statements[noCash.statements.length - 1].cash = null;
    expect(assessHoldingCache("BRAP4", noCash).reasons[0]).toMatch(/lacks cash/);

    const noShares = clone(committed("BRAP4"));
    noShares.shareClasses[0].outstandingShares = null;
    expect(assessHoldingCache("BRAP4", noShares).reasons).toContain("share-class counts missing");
  });
});

describe("assessHoldingCache — unusable (cache_pending)", () => {
  it("missing cache, unsupported ticker, wrong identity or schema", () => {
    expect(assessHoldingCache("ITSA3", null)).toMatchObject({ status: "unusable", reasons: ["holding cache ITSA4 missing or unreadable"] });
    expect(assessHoldingCache("ITUB4", committed("ITSA4")).status).toBe("unusable");

    const wrongIssuer = clone(committed("ITSA4"));
    wrongIssuer.issuer = { ...wrongIssuer.issuer, cvmCode: "19348" };   // Itaú Unibanco — never an alias
    expect(assessHoldingCache("ITSA4", wrongIssuer).status).toBe("unusable");

    expect(assessHoldingCache("BRAP3", committed("ITSA4")).status).toBe("unusable");   // other issuer's file

    const schema = clone(committed("BRAP4")) as unknown as { schemaVersion: number };
    schema.schemaVersion = 99;
    expect(assessHoldingCache("BRAP4", schema as unknown as HoldingCache).status).toBe("unusable");
  });
});
