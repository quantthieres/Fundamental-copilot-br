import { describe, expect, it } from "vitest";
import { fixtureText, fixtureZipLoader } from "./__fixtures__/fixtures";
import { loadHoldingCvmData } from "./holding-cvm-client";
import { VERIFIED_HOLDING_IDENTITIES } from "./holding-identities";
import { parseItausaPortfolioHtml } from "./itausa-portfolio";
import { portfolioFreshness } from "./holding-portfolio-validation";
import {
  PORTFOLIO_PRESERVED_WARNING,
  STATEMENTS_PRESERVED_WARNING,
  refreshHoldingCache,
  shortTermInvestmentDiagnostics,
  type CvmOutcome,
  type PortfolioOutcome,
  type SourceOutcome,
} from "./holding-refresh";
import { serializeHoldingCache } from "./holding-cache";
import type { HoldingCache, HoldingPortfolio } from "./holding-types";

const ITSA = VERIFIED_HOLDING_IDENTITIES.ITSA4;
const T0 = "2026-11-03T00:00:00.000Z";

async function cvmOk(years = { dfp: [2025], itr: [2025, 2026], optional: [] }): Promise<SourceOutcome<CvmOutcome>> {
  const d = await loadHoldingCvmData(ITSA, years, fixtureZipLoader());
  return { ok: true, value: { statements: d.statements, capital: d.capital, sources: d.sources } };
}
function portfolioOk(): SourceOutcome<PortfolioOutcome> {
  const r = parseItausaPortfolioHtml(fixtureText("itausa-portfolio-2026-10-15.html"));
  if (!r.ok) throw new Error(r.error);
  return { ok: true, value: { portfolio: r.portfolio, warnings: r.warnings } };
}
const down = (error: string) => ({ ok: false as const, error });

async function fullCache(): Promise<HoldingCache> {
  const r = refreshHoldingCache({ identity: ITSA, legalName: "ITAUSA S.A.", previous: null, cvm: await cvmOk(), portfolio: portfolioOk(), updatedAt: T0 });
  return r.cache!;
}

describe("refreshHoldingCache — failure semantics", () => {
  it("both sources ok → statements and portfolio advance", async () => {
    const c = await fullCache();
    expect(c.enrichment).toEqual({ statements: "ok", portfolio: "ok", issues: [] });
    expect(c.latestStatement).toMatchObject({ periodEnd: "2026-06-30", filingVersion: 2 });
    expect(c.portfolio?.portfolioReferenceDate).toBe("2026-09-30");
    expect(c.warnings).toEqual([]);
  });

  it("portfolio source fails → previous snapshot preserved intact, statements still advance", async () => {
    const prev = await fullCache();
    // Previous cache only knew 2025 filings.
    const older = { ...prev, statements: prev.statements.filter(s => s.periodEnd < "2026-01-01") };
    const r = refreshHoldingCache({ identity: ITSA, legalName: null, previous: older, cvm: await cvmOk(), portfolio: down("HTTP 503"), updatedAt: T0 });
    expect(r.write).toBe(true);
    expect(r.cache!.enrichment).toMatchObject({ statements: "ok", portfolio: "preserved" });
    expect(r.cache!.portfolio).toBe(prev.portfolio);   // same object: provenance untouched
    expect(r.cache!.latestStatement?.periodEnd).toBe("2026-06-30");
    expect(r.cache!.warnings).toContain(PORTFOLIO_PRESERVED_WARNING);
    expect(r.cache!.enrichment.issues[0]).toMatch(/portfolio source failed \(HTTP 503\)/);
  });

  it("CVM fails → previous statement history kept, new portfolio used", async () => {
    const prev = await fullCache();
    const r = refreshHoldingCache({ identity: ITSA, legalName: null, previous: prev, cvm: down("CVM ITR 2026 zip unavailable"), portfolio: portfolioOk(), updatedAt: T0 });
    expect(r.cache!.enrichment).toMatchObject({ statements: "preserved", portfolio: "ok" });
    expect(r.cache!.statements).toBe(prev.statements);
    expect(r.cache!.shareClasses).toBe(prev.shareClasses);
    expect(r.cache!.warnings).toContain(STATEMENTS_PRESERVED_WARNING);
  });

  it("both fail → nothing is written over a valid cache", async () => {
    const prev = await fullCache();
    const r = refreshHoldingCache({ identity: ITSA, legalName: null, previous: prev, cvm: down("x"), portfolio: down("y"), updatedAt: T0 });
    expect(r).toMatchObject({ write: false, cache: null });
  });

  it("no previous cache and CVM down → no cache (never an empty shell)", async () => {
    const r = refreshHoldingCache({ identity: ITSA, legalName: null, previous: null, cvm: down("x"), portfolio: portfolioOk(), updatedAt: T0 });
    expect(r.write).toBe(false);
  });

  it("no previous cache and portfolio down → statements only, portfolio null (no invented values)", async () => {
    const r = refreshHoldingCache({ identity: ITSA, legalName: null, previous: null, cvm: await cvmOk(), portfolio: down("HTTP 500"), updatedAt: T0 });
    const c = r.cache!;
    expect(c.portfolio).toBeNull();
    expect(c.enrichment.portfolio).toBe("failed");
    expect(c.indicators.core.officialPortfolioValue.value).toBeNull();
    expect(c.indicators.core.officialDiscount.value).toBeNull();
    expect(c.indicators.core.listedInvestmentValue.value).toBeNull();
    expect(c.indicators.core.holdingCash.value).toBe(2_191_000_000);
  });

  it("an older official snapshot never replaces a newer cached one", async () => {
    const prev = await fullCache();
    const stale = portfolioOk();
    if (!stale.ok) throw new Error();
    const older: HoldingPortfolio = { ...stale.value.portfolio, portfolioReferenceDate: "2026-08-31" };
    const r = refreshHoldingCache({ identity: ITSA, legalName: null, previous: prev, cvm: await cvmOk(),
      portfolio: { ok: true, value: { portfolio: older, warnings: [] } }, updatedAt: T0 });
    expect(r.cache!.portfolio?.portfolioReferenceDate).toBe("2026-09-30");
    expect(r.cache!.enrichment.portfolio).toBe("preserved");
  });

  it("statement history is merged, never shortened", async () => {
    const prev = await fullCache();
    const r = refreshHoldingCache({ identity: ITSA, legalName: null, previous: prev,
      cvm: await cvmOk({ dfp: [], itr: [2026], optional: [] }), portfolio: portfolioOk(), updatedAt: T0 });
    expect(r.cache!.statements.map(s => s.periodEnd)).toEqual(prev.statements.map(s => s.periodEnd));
  });

  it("output is deterministic except updatedAt", async () => {
    const a = await fullCache();
    const b = refreshHoldingCache({ identity: ITSA, legalName: "ITAUSA S.A.", previous: null, cvm: await cvmOk(), portfolio: portfolioOk(), updatedAt: "2027-01-01T00:00:00.000Z" }).cache!;
    expect(serializeHoldingCache({ ...b, updatedAt: a.updatedAt })).toBe(serializeHoldingCache(a));
  });
});

describe("portfolio freshness (source periods only)", () => {
  const pf = (portfolioReferenceDate: string) => ({ portfolioReferenceDate });

  it("fresh when no more than one fiscal quarter older than the latest statement", () => {
    expect(portfolioFreshness(pf("2026-09-30"), "2026-06-30")).toMatchObject({ status: "fresh", quarterLag: -1 });
    expect(portfolioFreshness(pf("2026-03-31"), "2026-06-30")).toMatchObject({ status: "fresh", quarterLag: 1 });
  });

  it("stale when two or more quarters older", () => {
    expect(portfolioFreshness(pf("2025-12-31"), "2026-06-30")).toMatchObject({ status: "stale", quarterLag: 2 });
  });

  it("unknown without a portfolio or statement", () => {
    expect(portfolioFreshness(null, "2026-06-30").status).toBe("unknown");
    expect(portfolioFreshness(pf("2026-09-30"), null).status).toBe("unknown");
  });

  it("a stale snapshot stays in the cache with a diagnostic", async () => {
    const prev = await fullCache();
    const old: HoldingPortfolio = { ...prev.portfolio!, portfolioReferenceDate: "2025-12-31" };
    const r = refreshHoldingCache({ identity: ITSA, legalName: null, previous: { ...prev, portfolio: old }, cvm: await cvmOk(), portfolio: down("x"), updatedAt: T0 });
    expect(r.cache!.portfolio).toBe(old);
    expect(r.cache!.portfolioFreshness.status).toBe("stale");
    expect(r.cache!.warnings.some(w => /mais de um trimestre/.test(w))).toBe(true);
  });
});

describe("Itaúsa 1.01.02 (NTS) reconciliation", () => {
  it("matches the NTS line of the official portfolio at 2026-06-30", async () => {
    const c = await fullCache();
    expect(shortTermInvestmentDiagnostics(c.statements[c.statements.length - 1], c.portfolio)).toEqual([]);
  });

  it("asks for re-verification when the amounts diverge (cash is never adjusted)", async () => {
    const c = await fullCache();
    const latest = c.statements[c.statements.length - 1];
    const changed = { ...latest, shortTermInvestments: { ...latest.shortTermInvestments!, value: 2_000_000_000 } };
    expect(shortTermInvestmentDiagnostics(changed, c.portfolio)[0]).toMatch(/must be re-verified/);
    expect(changed.cash).toBe(2_191_000_000);
  });
});
