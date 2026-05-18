import { describe, it, expect } from "vitest";
import { B3_UNIVERSE } from "@/data/b3-universe";
import {
  classifyB3Asset,
  getAssetTypeLabel,
  getCoverageReason,
  type RichAssetType,
} from "./cobertura-helpers";

// Helpers to find an asset by ticker
function find(ticker: string) {
  const a = B3_UNIVERSE.find(a => a.ticker === ticker);
  if (!a) throw new Error(`ticker not found in B3_UNIVERSE: ${ticker}`);
  return a;
}

// ── classifyB3Asset ───────────────────────────────────────────────────────────

describe("classifyB3Asset", () => {
  it("WEGE3 is common_stock", () => {
    expect(classifyB3Asset(find("WEGE3"))).toBe("common_stock");
  });

  it("PETR4 is preferred_stock", () => {
    expect(classifyB3Asset(find("PETR4"))).toBe("preferred_stock");
  });

  it("PETR3 is common_stock", () => {
    expect(classifyB3Asset(find("PETR3"))).toBe("common_stock");
  });

  it("KLBN11 is unit (operating company, not FII)", () => {
    expect(classifyB3Asset(find("KLBN11"))).toBe("unit");
  });

  it("ITUB4 is bank", () => {
    expect(classifyB3Asset(find("ITUB4"))).toBe("bank");
  });

  it("BBAS3 is bank", () => {
    expect(classifyB3Asset(find("BBAS3"))).toBe("bank");
  });

  it("SANB11 is bank (bank unit, not operating-company unit)", () => {
    expect(classifyB3Asset(find("SANB11"))).toBe("bank");
  });

  it("BBSE3 is insurance", () => {
    expect(classifyB3Asset(find("BBSE3"))).toBe("insurance");
  });

  it("ITSA4 is financial", () => {
    expect(classifyB3Asset(find("ITSA4"))).toBe("financial");
  });

  it("MXRF11 is fii", () => {
    expect(classifyB3Asset(find("MXRF11"))).toBe("fii");
  });

  it("IVVB11 is etf", () => {
    expect(classifyB3Asset(find("IVVB11"))).toBe("etf");
  });

  it("BOVA11 is etf", () => {
    expect(classifyB3Asset(find("BOVA11"))).toBe("etf");
  });
});

// ── getAssetTypeLabel ─────────────────────────────────────────────────────────

describe("getAssetTypeLabel", () => {
  const cases: [RichAssetType, string][] = [
    ["common_stock",    "Ação ON"],
    ["preferred_stock", "Ação PN"],
    ["unit",            "Unit"],
    ["bank",            "Banco"],
    ["insurance",       "Seguradora"],
    ["financial",       "Financeiro"],
    ["fii",             "FII"],
    ["etf",             "ETF"],
    ["bdr",             "BDR"],
    ["fund",            "Fundo"],
    ["unknown",         "—"],
  ];

  for (const [type, label] of cases) {
    it(`${type} → "${label}"`, () => {
      expect(getAssetTypeLabel(type)).toBe(label);
    });
  }
});

// ── getCoverageReason ─────────────────────────────────────────────────────────

describe("getCoverageReason", () => {
  it("full_analysis → dashboard message", () => {
    const reason = getCoverageReason(find("WEGE3"));
    expect(reason).toContain("Dashboard completo");
  });

  it("cvm_analysis → análise automática message", () => {
    const reason = getCoverageReason(find("PETR4"));
    expect(reason).toContain("DFP");
  });

  it("ITUB4 (bank, sector_specific) → bank model message", () => {
    const reason = getCoverageReason(find("ITUB4"));
    expect(reason).toContain("instituições financeiras");
  });

  it("BBSE3 (insurance, sector_specific) → insurance model message", () => {
    const reason = getCoverageReason(find("BBSE3"));
    expect(reason).toContain("seguradora");
  });

  it("MXRF11 (FII, sector_specific) → FII model message", () => {
    const reason = getCoverageReason(find("MXRF11"));
    expect(reason).toContain("fundos imobiliários");
  });

  it("IVVB11 (ETF, sector_specific) → ETF message", () => {
    const reason = getCoverageReason(find("IVVB11"));
    expect(reason).toContain("Fundo/índice");
  });

  it("ITSA4 (financial, sector_specific) → financial model message", () => {
    const reason = getCoverageReason(find("ITSA4"));
    expect(reason).toContain("infraestrutura financeira");
  });

  it("quote_only asset → cotação message", () => {
    const reason = getCoverageReason(find("RECV3")); // quote_only
    expect(reason).toContain("dados de mercado");
  });

  it("reason is never empty for any B3_UNIVERSE asset", () => {
    for (const asset of B3_UNIVERSE) {
      expect(getCoverageReason(asset).length).toBeGreaterThan(0);
    }
  });
});
