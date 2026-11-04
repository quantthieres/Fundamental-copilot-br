import { describe, it, expect } from "vitest";
import {
  AUDIT_DOC_PATH,
  classifyRefreshPaths,
  detectCacheRegression,
  isAllowedRefreshPath,
  isDateOnlyAuditDocChange,
  isTimestampOnlyJsonChange,
  isUnexpectedStatus,
  parsePorcelainZ,
} from "./refresh-guard";

const opts = { allowAuditDoc: true };

describe("path guard — accepted generated caches", () => {
  it.each([
    "src/data/cvm-cache/financials/WEGE3.json",
    "src/data/cvm-cache/documents/WEGE3.json",
    "src/data/cvm-cache/quarterly/WEGE3.json",
    "src/data/forecast-cache/time-series/WEGE3.json",
    "src/data/forecast-cache/baseline-forecasts/WEGE3.json",
    "src/data/bank-cache/annual/ITUB4.json",
    "src/data/fii-cache/monthly/MXRF11.json",
    "src/data/insurance-cache/annual/BBSE3.json",
    "src/data/holding-cache/ITSA4.json",
  ])("accepts %s", path => {
    expect(isAllowedRefreshPath(path, opts)).toBe(true);
  });

  it("accepts the regenerated audit markdown only when configured", () => {
    expect(isAllowedRefreshPath(AUDIT_DOC_PATH, { allowAuditDoc: true })).toBe(true);
    expect(isAllowedRefreshPath(AUDIT_DOC_PATH, { allowAuditDoc: false })).toBe(false);
    expect(isAllowedRefreshPath(AUDIT_DOC_PATH)).toBe(false);
  });
});

describe("path guard — rejected paths", () => {
  it.each([
    "src/lib/cvm/dfp-client.ts",
    "src/app/api/coverage/[ticker]/route.ts",
    "src/components/dashboard/ForecastPanel.tsx",
    "scripts/precompute-cvm-cache.ts",
    "package.json",
    "package-lock.json",
    "README.md",
    ".github/workflows/cache-refresh.yml",
    "src/data/b3-universe.ts",
    "src/data/cvm-cache/README.md",
    "src/data/cvm-cache/dfp_cia_aberta_2024.zip",
    "src/data/cvm-cache/financials/dfp_cia_aberta_DRE_con_2024.csv",
    "dfp_cia_aberta_2024.zip",
    "src/data/fii-cache/monthly/MXRF11.json.tmp",
    "src/data/cvm-cache/../../lib/x.json",
    "docs/other-doc.md",
  ])("rejects %s", path => {
    expect(isAllowedRefreshPath(path, opts)).toBe(false);
  });
});

describe("classifyRefreshPaths", () => {
  it("accepts an empty change list", () => {
    expect(classifyRefreshPaths([], opts)).toEqual({ safe: [], unsafe: [] });
  });

  it("reports every unsafe path in a mixed list", () => {
    const result = classifyRefreshPaths([
      "src/data/cvm-cache/financials/WEGE3.json",
      "src/lib/cvm/dfp-client.ts",
      "src/data/bank-cache/annual/ITUB4.json",
      "package.json",
    ], opts);
    expect(result.safe).toEqual([
      "src/data/cvm-cache/financials/WEGE3.json",
      "src/data/bank-cache/annual/ITUB4.json",
    ]);
    expect(result.unsafe).toEqual(["src/lib/cvm/dfp-client.ts", "package.json"]);
  });
});

describe("parsePorcelainZ", () => {
  it("parses modified, untracked and renamed entries", () => {
    const out = " M src/data/cvm-cache/financials/WEGE3.json\0?? src/data/x.zip\0R  new.json\0src/lib/old.ts\0";
    expect(parsePorcelainZ(out)).toEqual([
      { status: " M", path: "src/data/cvm-cache/financials/WEGE3.json" },
      { status: "??", path: "src/data/x.zip" },
      { status: "R ", path: "new.json" },
      { status: "R ", path: "src/lib/old.ts" },
    ]);
  });

  it("returns nothing for a clean tree", () => {
    expect(parsePorcelainZ("")).toEqual([]);
  });

  it("flags deletions and renames as unexpected", () => {
    expect(isUnexpectedStatus(" M")).toBe(false);
    expect(isUnexpectedStatus("??")).toBe(false);
    expect(isUnexpectedStatus(" D")).toBe(true);
    expect(isUnexpectedStatus("R ")).toBe(true);
  });
});

describe("timestamp-only changes", () => {
  const base = { ticker: "WEGE3", generatedAt: "2026-05-17T05:05:55.228Z", financials: [{ fiscalYear: 2024, revenue: 1 }] };

  it("treats a new generatedAt/updatedAt alone as no change", () => {
    const next = { ...base, generatedAt: "2026-11-08T06:30:00.000Z" };
    expect(isTimestampOnlyJsonChange(JSON.stringify(base, null, 2), JSON.stringify(next, null, 2))).toBe(true);
    const bank = { ticker: "ITUB4", updatedAt: "a", annual: [] };
    expect(isTimestampOnlyJsonChange(JSON.stringify(bank), JSON.stringify({ ...bank, updatedAt: "b" }))).toBe(true);
  });

  it("keeps real data changes", () => {
    const next = { ...base, generatedAt: "x", financials: [{ fiscalYear: 2024, revenue: 2 }] };
    expect(isTimestampOnlyJsonChange(JSON.stringify(base), JSON.stringify(next))).toBe(false);
  });

  it("ignores nested fields named like timestamps only at top level", () => {
    const a = { generatedAt: "1", meta: { generatedAt: "1" } };
    const b = { generatedAt: "2", meta: { generatedAt: "2" } };
    expect(isTimestampOnlyJsonChange(JSON.stringify(a), JSON.stringify(b))).toBe(false);
  });

  it("never treats invalid JSON as timestamp-only", () => {
    expect(isTimestampOnlyJsonChange("{", "{")).toBe(false);
  });

  it("detects a date-only change in the audit markdown", () => {
    const a = "# T\n\n_Gerado em 2026-11-02 por `npm run coverage:audit:quote-only`._\n\nbody\n";
    const b = a.replace("2026-11-02", "2026-11-08");
    expect(isDateOnlyAuditDocChange(a, b)).toBe(true);
    expect(isDateOnlyAuditDocChange(a, b.replace("body", "changed"))).toBe(false);
  });
});

describe("detectCacheRegression", () => {
  const s = (v: unknown) => JSON.stringify(v);

  it("accepts a new file that parses", () => {
    expect(detectCacheRegression("src/data/cvm-cache/financials/NEW3.json", null, s({ financials: [] }))).toEqual([]);
  });

  it("rejects invalid JSON", () => {
    expect(detectCacheRegression("src/data/cvm-cache/financials/X.json", s({}), "{oops")).not.toEqual([]);
  });

  it("accepts added history", () => {
    const old = { financials: [{ fiscalYear: 2023 }, { fiscalYear: 2024 }] };
    const next = { financials: [{ fiscalYear: 2023 }, { fiscalYear: 2024 }, { fiscalYear: 2025 }] };
    expect(detectCacheRegression("src/data/cvm-cache/financials/X.json", s(old), s(next))).toEqual([]);
  });

  it("rejects annual financials emptied by a failed download", () => {
    const old = { financials: [{ fiscalYear: 2023 }, { fiscalYear: 2024 }] };
    const problems = detectCacheRegression("src/data/cvm-cache/financials/X.json", s(old), s({ financials: [] }));
    expect(problems.length).toBeGreaterThan(0);
  });

  it("rejects fewer quarters, series and forecasts", () => {
    expect(detectCacheRegression("src/data/cvm-cache/quarterly/X.json", s({ quarterly: [1, 2] }), s({ quarterly: [1] }))).not.toEqual([]);
    expect(detectCacheRegression("src/data/forecast-cache/time-series/X.json", s({ series: [1, 2] }), s({ series: [1] }))).not.toEqual([]);
    expect(detectCacheRegression("src/data/forecast-cache/baseline-forecasts/X.json", s({ forecasts: [1] }), s({ forecasts: [] }))).not.toEqual([]);
  });

  it("documents may rotate but not disappear", () => {
    const p = "src/data/cvm-cache/documents/X.json";
    expect(detectCacheRegression(p, s({ documents: [1, 2, 3] }), s({ documents: [4] }))).toEqual([]);
    expect(detectCacheRegression(p, s({ documents: [1] }), s({ documents: [] }))).not.toEqual([]);
  });

  it("rejects a bank/insurance cache flipping to unavailable or losing years", () => {
    const old = { available: true, annual: [1, 2, 3] };
    expect(detectCacheRegression("src/data/bank-cache/annual/ITUB4.json", s(old), s({ available: false, annual: [] }))).not.toEqual([]);
    expect(detectCacheRegression("src/data/insurance-cache/annual/BBSE3.json", s(old), s({ available: true, annual: [1, 2] }))).not.toEqual([]);
    expect(detectCacheRegression("src/data/insurance-cache/annual/BBSE3.json", s(old), s({ available: true, annual: [1, 2, 3, 4] }))).toEqual([]);
  });

  it("keeps existing placeholders acceptable", () => {
    const placeholder = { available: false, annual: [] };
    expect(detectCacheRegression("src/data/insurance-cache/annual/SULA11.json", s(placeholder), s(placeholder))).toEqual([]);
  });

  it("FII: rolling window may shrink, latest month may not go back", () => {
    const p = "src/data/fii-cache/monthly/MXRF11.json";
    const old = { available: true, records: [{ referenceDate: "2026-08-01" }, { referenceDate: "2026-09-01" }] };
    expect(detectCacheRegression(p, s(old), s({ available: true, records: [{ referenceDate: "2026-10-01" }] }))).toEqual([]);
    expect(detectCacheRegression(p, s(old), s({ available: true, records: [{ referenceDate: "2026-08-01" }] }))).not.toEqual([]);
    expect(detectCacheRegression(p, s(old), s({ available: false, records: [] }))).not.toEqual([]);
  });

  it("FII: a Fundos.Net month may not fall back to the CVM estimate", () => {
    const p = "src/data/fii-cache/monthly/BTHF11.json";
    const rec = (m: string, src: string | null) => ({ referenceDate: m, distributionSource: src });
    const old = { available: true, records: [rec("2026-08-01", "fnet_structured"), rec("2026-09-01", "fnet_structured")] };
    const failed = { available: true, records: [rec("2026-08-01", null), rec("2026-09-01", null)] };
    const rolled = { available: true, records: [rec("2026-09-01", "fnet_structured"), rec("2026-10-01", null)] };
    expect(detectCacheRegression(p, s(old), s(failed))).toEqual(["Fundos.Net distribution lost for 2026-08-01, 2026-09-01"]);
    expect(detectCacheRegression(p, s(old), s(rolled))).toEqual([]);
  });

  describe("holding cache", () => {
    const p = "src/data/holding-cache/ITSA4.json";
    const issuer = { canonicalTicker: "ITSA4", cvmCode: "7617", cnpj: "61.532.644/0001-15" };
    const portfolio = { portfolioReferenceDate: "2026-09-30", components: [1, 2, 3] };
    const base = { issuer, statements: [1, 2], latestStatement: { periodEnd: "2026-06-30" }, portfolio };

    it("accepts statements and portfolio advancing", () => {
      const next = { ...base, statements: [1, 2, 3], latestStatement: { periodEnd: "2026-09-30" },
        portfolio: { ...portfolio, portfolioReferenceDate: "2026-10-31" } };
      expect(detectCacheRegression(p, s(base), s(next))).toEqual([]);
      expect(detectCacheRegression(p, s(base), s(base))).toEqual([]);
    });

    it("rejects an identity change", () => {
      const next = { ...base, issuer: { ...issuer, cvmCode: "19348" } };
      expect(detectCacheRegression(p, s(base), s(next))).toEqual(["issuer.cvmCode changed from 7617 to 19348"]);
    });

    it("rejects the latest statement period going backwards or history shrinking", () => {
      expect(detectCacheRegression(p, s(base), s({ ...base, latestStatement: { periodEnd: "2026-03-31" } })))
        .toEqual(["latest statement period went from 2026-06-30 to 2026-03-31"]);
      expect(detectCacheRegression(p, s(base), s({ ...base, statements: [1] }))).toEqual(['"statements" shrank from 2 to 1 entries']);
    });

    it("rejects the portfolio going backwards, disappearing or emptying", () => {
      expect(detectCacheRegression(p, s(base), s({ ...base, portfolio: { ...portfolio, portfolioReferenceDate: "2026-08-31" } })))
        .toEqual(["portfolio reference date went from 2026-09-30 to 2026-08-31"]);
      expect(detectCacheRegression(p, s(base), s({ ...base, portfolio: null }))).toEqual(["validated portfolio snapshot disappeared"]);
      expect(detectCacheRegression(p, s(base), s({ ...base, portfolio: { ...portfolio, components: [] } })))
        .toEqual(["portfolio components went from 3 to 0"]);
    });

    it("a first portfolio after none is fine", () => {
      expect(detectCacheRegression(p, s({ ...base, portfolio: null }), s(base))).toEqual([]);
    });
  });
});
