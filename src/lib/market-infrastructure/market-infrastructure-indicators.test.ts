import { describe, expect, it } from "vitest";
import { WORKBOOK_SOURCE, loadFixtureCvm, parsedWorkbookFixture } from "./__fixtures__/fixtures";
import { computeMarketInfrastructureIndicators, type IndicatorInputs } from "./market-infrastructure-indicators";
import { buildFinancialPosition } from "./market-infrastructure-financial-position";
import { buildCapitalAllocation, normalizeShareCounts, outstandingSharesChange } from "./market-infrastructure-capital";
import { collectSegmentCandidates, selectSegmentHistory } from "./market-infrastructure-segments";
import { validateOperatingMetrics } from "./market-infrastructure-kpis";
import { computeTtm } from "./market-infrastructure-statements";
import { FORBIDDEN_INDICATOR_PATTERN } from "./market-infrastructure-cache";
import { CORE_INDICATOR_KEYS, SECONDARY_INDICATOR_KEYS } from "./market-infrastructure-types";

const K = 1_000;

async function inputs(): Promise<IndicatorInputs> {
  const cvm = await loadFixtureCvm();
  const statements = cvm.statements;
  const shareCounts = normalizeShareCounts(cvm.shareCounts);
  const v = validateOperatingMetrics(parsedWorkbookFixture(), WORKBOOK_SOURCE, statements);
  return {
    statements,
    revenueSegments: selectSegmentHistory(collectSegmentCandidates(cvm.filings), "2026-06-30").snapshots,
    operatingMetrics: v.ok ? v.snapshot : null,
    financialPosition: buildFinancialPosition(statements[statements.length - 1]),
    capitalAllocation: buildCapitalAllocation(statements, shareCounts),
    shareCounts,
  };
}

describe("indicator key sets", () => {
  it("exactly the approved CORE and SECONDARY keys", async () => {
    const ind = computeMarketInfrastructureIndicators(await inputs());
    expect(Object.keys(ind.core)).toEqual([...CORE_INDICATOR_KEYS]);
    expect(Object.keys(ind.secondary)).toEqual([...SECONDARY_INDICATOR_KEYS]);
  });

  it("no industrial gross margin, FCF, net debt, EV multiple, P/L, ROIC, take rate or valuation", async () => {
    const ind = computeMarketInfrastructureIndicators(await inputs());
    const keys = [...Object.keys(ind.core), ...Object.keys(ind.secondary)];
    expect(keys.filter(k => FORBIDDEN_INDICATOR_PATTERN.test(k))).toEqual([]);
    for (const k of ["grossMargin", "freeCashFlow", "fcfYield", "cfoMargin", "netDebt", "evEbit", "evRevenue", "priceEarnings", "roic", "returnOnTangibleEquity", "takeRate", "segmentRevenueTtm", "fairValue", "targetPrice", "upside"]) {
      expect(FORBIDDEN_INDICATOR_PATTERN.test(k) || !keys.includes(k), k).toBe(true);
      expect(keys).not.toContain(k);
    }
  });
});

describe("CORE indicators at 2T26", () => {
  it("company-level TTM figures and ratios", async () => {
    const i = await inputs();
    const { core } = computeMarketInfrastructureIndicators(i);
    const ttm = ["2026-06-30", "+2025-12-31", "-2025-06-30"];
    expect(core.netRevenueTtm).toMatchObject({ value: 10_777_143 * K, unit: "BRL", composition: ttm });
    const prior = computeTtm(i.statements, "2025-06-30", "netRevenueYtd").value!;
    expect(core.netRevenueYoyGrowth.value).toBeCloseTo(10_777_143 * K / prior - 1, 6);
    expect(core.netRevenueYoyGrowth.composition).toEqual([...ttm, "vs 2025-06-30", "vs +2024-12-31", "vs -2024-06-30"]);
    expect(core.grossRevenueCurrentPeriod).toMatchObject({ value: 3_081_392 * K, composition: ["2026-04-01..2026-06-30"] });
    expect(core.operatingMargin.value).toBeCloseTo(7_119_850 / 10_777_143, 6);
    expect(core.ebitdaTtm).toMatchObject({ value: 7_503_457 * K, composition: ttm });
    expect(core.ebitdaMargin.value).toBeCloseTo(7_503_457 / 10_777_143, 6);
    expect(core.netIncomeAttributableTtm.value).toBe(5_329_711 * K);
    expect(core.grossDebt).toMatchObject({ value: 14_933_316 * K, composition: ["2026-06-30"] });
    expect(core.managedNetFinancialPosition).toMatchObject({ value: 1_560_977 * K, composition: ["2026-06-30"] });
    expect(core.grossDebtToEbitdaTtm).toMatchObject({ unit: "multiple" });
    expect(core.grossDebtToEbitdaTtm.value).toBeCloseTo(1.990191, 6);
    expect(core.shareholderDistributionsTtm.value).toBe(2_412_006 * K);
    expect(core.buybacksTtm.value).toBe(2_761_585 * K);
  });

  it("segment mix is one period of the latest filing", async () => {
    const { core } = computeMarketInfrastructureIndicators(await inputs());
    expect(core.revenueSegmentMix.composition).toEqual(["quarter 2026-04-01..2026-06-30"]);
    expect(core.revenueSegmentMix.lines!.map(l => l.segmentId)).toEqual(["mercados", "solucoes_analiticas_de_dados", "solucoes_para_mercado_de_capitais", "tecnologia_e_plataformas", "outras_receitas"]);
    expect(core.revenueSegmentMix.lines![0].share).toBeCloseTo(2_034_450 / 3_081_392, 6);
  });

  it("official operating KPIs keep B3's units", async () => {
    const { core } = computeMarketInfrastructureIndicators(await inputs());
    expect(core.derivativesAdv).toMatchObject({ unit: "workbook_unit", publishedUnit: "milhares de contratos/dia (média do trimestre)", composition: ["2T26"] });
    expect(core.derivativesRpc.value).toBeCloseTo(1.180121, 5);
    expect(core.cashEquitiesAdtv.value).toBeCloseTo(31_309.775533, 5);
    expect(core.cashEquitiesFeeMarginBps.value).toBeCloseTo(3.074342, 5);
    expect(core.fixedIncomeBankingInstrumentsAverageStock).toMatchObject({ publishedUnit: "R$ bilhões (média do trimestre)", composition: ["2T26"] });
    expect(core.fixedIncomeBankingInstrumentsAverageStock.value).toBeCloseTo(5_431.097122, 5);
    expect(core.fixedIncomeCorporateBondsAverageStock.value).toBeCloseTo(1_466.457907, 5);
    expect(core.fixedIncomeOtherAverageStock.value).toBeCloseTo(2_789.562737, 5);
  });

  it("fixed income & credit: three official components, no derived aggregate", async () => {
    const ind = computeMarketInfrastructureIndicators(await inputs());
    const keys = [...Object.keys(ind.core), ...Object.keys(ind.secondary)].filter(k => /fixedIncome/i.test(k));
    expect(keys).toEqual(["fixedIncomeBankingInstrumentsAverageStock", "fixedIncomeCorporateBondsAverageStock", "fixedIncomeOtherAverageStock"]);
    for (const k of keys) expect(ind.core[k as "fixedIncomeOtherAverageStock"].parts, k).toBeUndefined();
  });

  it("outstanding-share change over 12 months (2026-06-30 vs 2025-06-30)", async () => {
    const { core } = computeMarketInfrastructureIndicators(await inputs());
    expect(core.outstandingSharesChange).toMatchObject({
      value: 4_998_298_548 - (5_266_500_000 - 69_454_276),
      unit: "shares",
      composition: ["2026-06-30", "vs 2025-06-30"],
    });
    expect(core.outstandingSharesChange.parts!.latestOutstanding).toBe(4_998_298_548);
  });

  it("a split between the two dates makes the change non-comparable", () => {
    const counts = [
      { referenceDate: "2020-06-30", document: "ITR" as const, filingVersion: 1, issuedShares: 2_059_138_490, treasuryShares: 15_511_534, outstandingShares: 2_043_626_956 },
      { referenceDate: "2021-06-30", document: "ITR" as const, filingVersion: 1, issuedShares: 6_126_000_000, treasuryShares: 53_169_049, outstandingShares: 6_072_830_951 },
    ];
    expect(outstandingSharesChange(counts)).toMatchObject({ change: null, reason: expect.stringMatching(/split/) });
  });

  it("descriptive one-off flag for non-recurring operating lines (Dimensa gain in 2T26) — no adjustment", async () => {
    const ind = computeMarketInfrastructureIndicators(await inputs());
    expect(ind.oneOffFlag).toEqual({ flagged: true, amountTtm: 123_875 * K, lines: ["3.04.04 Outras Receitas Operacionais: 123875000"] });
    expect(ind.core.netIncomeAttributableTtm.value).toBe(5_329_711 * K);
  });
});

describe("SECONDARY indicators", () => {
  it("expense composition, capex, ROE, effective tax rate", async () => {
    const { secondary } = computeMarketInfrastructureIndicators(await inputs());
    expect(secondary.expenseComposition).toMatchObject({ value: -975_625 * K, composition: ["2T26"] });
    expect(secondary.expenseComposition.parts!["Pessoal e encargos"]).toBe(-459_758 * K);
    expect(secondary.capexTtm.value).toBe((14_161 + 92_789 + 145_242 + 142_031 - 33_815 - 53_691) * K);
    expect(secondary.returnOnEquity.note).toMatch(/ágio/);
    expect(secondary.returnOnEquity.value).toBeCloseTo(5_329_711 / (((18_729_402 - 24_439) + (19_750_226 - 14_079)) / 2), 6);
    expect(secondary.effectiveTaxRateTtm.value).toBeGreaterThan(0);
  });
});

describe("nullable behaviour — never zero", () => {
  it("without a workbook snapshot every KPI is null with a reason", async () => {
    const { core, secondary } = computeMarketInfrastructureIndicators({ ...(await inputs()), operatingMetrics: null });
    for (const k of ["derivativesAdv", "derivativesRpc", "cashEquitiesAdtv", "cashEquitiesFeeMarginBps", "fixedIncomeBankingInstrumentsAverageStock", "fixedIncomeCorporateBondsAverageStock", "fixedIncomeOtherAverageStock"] as const) {
      expect(core[k].value, k).toBeNull();
      expect(core[k].reason, k).toBe("no validated workbook snapshot");
    }
    expect(secondary.expenseComposition.value).toBeNull();
    expect(core.netRevenueTtm.value).not.toBeNull();
  });

  it("with no statements every statement indicator is null", async () => {
    const i = await inputs();
    const { core } = computeMarketInfrastructureIndicators({ ...i, statements: [], revenueSegments: [], financialPosition: null, capitalAllocation: buildCapitalAllocation([], []), shareCounts: [] });
    for (const k of ["netRevenueTtm", "netRevenueYoyGrowth", "operatingMargin", "ebitdaTtm", "ebitdaMargin", "netIncomeAttributableTtm", "grossDebt", "managedNetFinancialPosition", "grossDebtToEbitdaTtm", "shareholderDistributionsTtm", "buybacksTtm", "outstandingSharesChange", "revenueSegmentMix"] as const) {
      expect(core[k].value, k).toBeNull();
    }
  });
});
