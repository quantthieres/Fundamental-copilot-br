// Regression: the FII report used to read the cached `indicators`, which the
// cache stores as null on purpose, so every indicator rendered as "—".
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { readFiiCache } from "./fii-cache";
import { getCurrentFiiCacheTickers } from "./fii-coverage";
import { fiiDisplayIndicators } from "./fii-indicators";

describe("FII report indicators", () => {
  it("are computed from records + quote although the cache stores indicators: null", () => {
    for (const t of getCurrentFiiCacheTickers()) {
      const cache = readFiiCache(t)!;
      expect(cache.indicators, t).toBeNull();
      const ind = fiiDisplayIndicators(cache, 100)!;
      expect(ind.netAssetValuePerShare, t).not.toBeNull();
      expect(ind.priceToBookValuePerShare, t).not.toBeNull();
      expect(ind.lastDistributionPerShare, t).not.toBeNull();
      expect(ind.dividendYield12m, t).not.toBeNull();
    }
  });

  it("the report page computes indicators and never reads the cached field", () => {
    const src = readFileSync(join(process.cwd(), "src/app/relatorio/[ticker]/page.tsx"), "utf-8");
    const fiiReport = src.slice(src.indexOf("function FiiReport"), src.indexOf("// ─── Insurance report"));
    expect(fiiReport).toContain("fiiDisplayIndicators(data, quote?.price ?? null)");
    expect(fiiReport).not.toContain("data.indicators");
  });
});
