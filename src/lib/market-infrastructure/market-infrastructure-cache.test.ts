import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { B3_UNIVERSE } from "../../data/b3-universe";
import { resolveModelRoute } from "../coverage/model-routing";
import { assessAssetReadiness } from "../coverage/asset-readiness-inputs";
import { classifyAsset } from "../coverage/asset-classifier";
import {
  marketInfrastructureCachePath,
  readMarketInfrastructureCache,
  serializeMarketInfrastructureCache,
  validateMarketInfrastructureCache,
} from "./market-infrastructure-cache";
import { assessMarketInfrastructureCache } from "./market-infrastructure-readiness";

const ROOT = process.cwd();

describe("committed B3SA3 market-infrastructure cache", () => {
  const cache = readMarketInfrastructureCache("B3SA3");

  it("exists, is structurally valid and is an analysis_ready candidate", () => {
    expect(cache).not.toBeNull();
    expect(validateMarketInfrastructureCache("B3SA3", cache)).toEqual([]);
    expect(assessMarketInfrastructureCache("B3SA3", cache)).toEqual({ candidate: "analysis_ready", reasons: [] });
  });

  it("is serialized exactly as the writer would (stable key order, trailing newline)", () => {
    expect(readFileSync(marketInfrastructureCachePath("B3SA3"), "utf-8")).toBe(serializeMarketInfrastructureCache(cache!));
  });

  it("history from FY2019, consolidated only, segments from FY2024", () => {
    expect(cache!.statements[0].periodEnd).toBe("2019-03-31");
    expect(cache!.statements.filter(s => s.document === "DFP").map(s => s.fiscalYear)).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    expect(cache!.statements.every(s => s.basis === "consolidated")).toBe(true);
    expect(cache!.revenueSegments[0].periodEnd).toBe("2024-12-31");
  });

  it("only B3SA3 resolves to a market-infrastructure cache", () => {
    for (const t of ["B3SA4", "ITSA4", "ALOS3", "MULT3", "IGTI11", "JHSF3", "CIEL3"]) expect(readMarketInfrastructureCache(t), t).toBeNull();
    expect(readdirSync(join(ROOT, "src/data/market-infrastructure-cache"))).toEqual(["B3SA3.json"]);
  });

  it("validation flags structural problems", () => {
    const broken = structuredClone(cache!);
    broken.statements[broken.statements.length - 1].basis = "individual" as "consolidated";
    broken.revenueSegments[0].reconciliation.passed = false;
    (broken.indicators.core as Record<string, unknown>).grossMargin = broken.indicators.core.netRevenueTtm;
    const p = validateMarketInfrastructureCache("B3SA3", broken);
    expect(p).toEqual(expect.arrayContaining(["non-consolidated statement basis", expect.stringMatching(/without a passed reconciliation/), expect.stringMatching(/core indicator keys/), expect.stringMatching(/forbidden indicators: grossMargin/)]));
    expect(validateMarketInfrastructureCache("B3SA3", null)).toEqual(["cache file missing or unreadable"]);
  });
});

describe("Phase 1 routing safety — B3SA3 stays quote_only / model_pending", () => {
  const b3 = B3_UNIVERSE.find(a => a.ticker === "B3SA3")!;

  it("the new cache does not route B3SA3 into the industrial (or any) model", () => {
    expect(existsSync(marketInfrastructureCachePath("B3SA3"))).toBe(true);
    expect(b3.coverageStatus).toBe("quote_only");
    expect(classifyAsset("B3SA3", { b3AssetType: b3.assetType, sector: b3.sector, companyName: b3.companyName })).toBe("financial");
    expect(resolveModelRoute(b3)).toBe("quote_only");
    expect(assessAssetReadiness(b3)).toMatchObject({ readiness: "model_pending" });
  });

  it("no runtime module (app, components, coverage, API) imports the market-infrastructure model yet", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(full);
      }
    };
    for (const dir of ["src/app", "src/components", "src/lib/coverage", "src/lib/cvm", "src/lib/fundamentals", "src/lib/holdings", "src/lib/banks"]) walk(join(ROOT, dir));
    const importers = files.filter(f => /from\s+["'][^"']*market-infrastructure\/|import\(\s*["'][^"']*market-infrastructure\//.test(readFileSync(f, "utf-8"))).map(f => relative(ROOT, f));
    expect(importers).toEqual([]);
  });

  it("network-capable modules are imported only by scripts and tests", () => {
    const dir = join(ROOT, "src/lib/market-infrastructure");
    const libFiles = readdirSync(dir).filter(f => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    const importersOf = (mod: string) => libFiles.filter(f => readFileSync(join(dir, f), "utf-8").includes(`./${mod}"`));
    expect(importersOf("b3-workbook-source")).toEqual([]);
    expect(importersOf("market-infrastructure-cvm-client")).toEqual([]);
    // Pure modules never fetch.
    for (const f of libFiles.filter(f => !["b3-workbook-source.ts", "market-infrastructure-cvm-client.ts"].includes(f))) {
      expect(readFileSync(join(dir, f), "utf-8"), f).not.toMatch(/\bfetch\(|fetchYearZip|fetchItrYearZip/);
    }
  });
});
