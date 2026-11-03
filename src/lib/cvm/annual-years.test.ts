import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { countUsableAnnualYears } from "./annual-years";
import { parseFinancialsCache } from "./precomputed-cache";
import { annualCacheYears } from "@/lib/coverage/asset-readiness-inputs";
import { assessAssetReadiness } from "@/lib/coverage/asset-readiness-inputs";
import { B3_UNIVERSE } from "@/data/b3-universe";

describe("countUsableAnnualYears", () => {
  it("counts distinct fiscal years with at least one numeric value", () => {
    expect(countUsableAnnualYears([])).toBe(0);
    expect(countUsableAnnualYears(null)).toBe(0);
    expect(countUsableAnnualYears([{ fiscalYear: 2020, revenue: 36.0 }])).toBe(1);
    expect(countUsableAnnualYears([
      { fiscalYear: 2024, revenue: 1 }, { fiscalYear: 2024, ebit: 2 },  // duplicate year
      { fiscalYear: 2025, revenue: null, ebit: null },                   // no values
      { fiscalYear: "2023", revenue: 1 },                                // malformed year
    ])).toBe(1);
  });
});

// Regression for the earlier report:audit / readiness disagreement: report:audit
// printed a hard-coded "1 year" for every <2-year cache, while CGAS3 and SAPR11
// actually have empty `financials` arrays. Both audits now share one counter.
// Assertions compare the two code paths (not pinned counts), so a future cache
// refresh that fixes the data does not break the weekly validation.
describe("CGAS3 / SAPR11 / ASAI3 — audits agree on usable annual years", () => {
  for (const ticker of ["CGAS3", "SAPR11", "ASAI3"]) {
    it(ticker, () => {
      const raw = readFileSync(join(process.cwd(), "src/data/cvm-cache/financials", `${ticker}.json`), "utf-8");
      const reportAuditCount = countUsableAnnualYears(parseFinancialsCache(raw));
      expect(annualCacheYears(ticker)).toBe(reportAuditCount);
      const readiness = assessAssetReadiness(B3_UNIVERSE.find(a => a.ticker === ticker)!).readiness;
      expect(readiness).toBe(reportAuditCount >= 2 ? "analysis_ready" : "analysis_limited");
    });
  }
});
