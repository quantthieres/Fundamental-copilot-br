import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { hasBankAnalysisCache } from "@/lib/banks/bank-coverage";
import { hasFiiAnalysisCache } from "@/lib/fiis/fii-coverage";
import { hasInsuranceAnalysisCache } from "@/lib/insurance/insurance-coverage";

// Sector model caches can be intentional placeholders written with
// `available: false` (e.g. SULA11 incorporated, BCFF11 without CNPJ).
// The CACHED_TICKERS sets must contain exactly the `available: true` files.

const DATA_ROOT = join(process.cwd(), "src/data");

const MODELS = [
  { name: "bank",      dir: "bank-cache/annual",      has: hasBankAnalysisCache },
  { name: "fii",       dir: "fii-cache/monthly",      has: hasFiiAnalysisCache },
  { name: "insurance", dir: "insurance-cache/annual", has: hasInsuranceAnalysisCache },
] as const;

function readAvailability(dir: string): { ticker: string; available: boolean }[] {
  const full = join(DATA_ROOT, dir);
  return readdirSync(full)
    .filter(f => f.endsWith(".json"))
    .map(f => {
      const parsed = JSON.parse(readFileSync(join(full, f), "utf-8")) as { available?: unknown };
      return { ticker: f.replace(/\.json$/, ""), available: parsed.available !== false };
    });
}

describe("sector model cache sets match available:true cache files", () => {
  for (const { name, dir, has } of MODELS) {
    it(`${name}: in CACHED_TICKERS ⇔ cache file is available`, () => {
      for (const { ticker, available } of readAvailability(dir)) {
        expect(has(ticker), `${name}/${ticker}`).toBe(available);
      }
    });
  }

  it("known placeholders are not active coverage", () => {
    expect(hasInsuranceAnalysisCache("SULA11")).toBe(false);
    expect(hasFiiAnalysisCache("BCFF11")).toBe(false);
  });
});
