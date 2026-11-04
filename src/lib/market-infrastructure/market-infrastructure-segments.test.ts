import { describe, expect, it } from "vitest";
import { loadFixtureCvm } from "./__fixtures__/fixtures";
import * as segments from "./market-infrastructure-segments";
import { collectSegmentCandidates, currentSegmentSnapshot, parseSegmentPeriod, selectSegmentHistory } from "./market-infrastructure-segments";
import type { RawFiling } from "./market-infrastructure-cvm-rows";

const K = 1_000;

async function filings(): Promise<RawFiling[]> {
  return (await loadFixtureCvm()).filings;
}
const filingOf = (fs: RawFiling[], doc: "DFP" | "ITR", ref: string) => structuredClone(fs.find(f => f.document === doc && f.filingReferenceDate === ref)!);
const Q2_26 = { periodStart: "2026-04-01", periodEnd: "2026-06-30", periodKind: "quarter" as const, comparative: false };

describe("current segment taxonomy (CVM 3.01.0x)", () => {
  it("2T26 quarter: five lines, Σ = 3.01", async () => {
    const parsed = parseSegmentPeriod(filingOf(await filings(), "ITR", "2026-06-30"), Q2_26);
    expect(parsed.status).toBe("ok");
    if (parsed.status !== "ok") return;
    expect(parsed.snapshot.lines.map(l => [l.segmentId, l.label, l.value])).toEqual([
      ["mercados", "Mercados", 2_034_450 * K],
      ["solucoes_analiticas_de_dados", "Soluções Analíticas de Dados (Trillia)", 315_162 * K],
      ["solucoes_para_mercado_de_capitais", "Soluções para o Mercado de Capitais", 200_999 * K],
      ["tecnologia_e_plataformas", "Tecnologia & Plataformas", 526_814 * K],
      ["outras_receitas", "Reversão de Provisões e Recuperação de Despesas", 3_967 * K],
    ]);
    expect(parsed.snapshot.reconciliation).toEqual({ sumOfLines: 3_081_392 * K, grossRevenue: 3_081_392 * K, difference: 0, tolerance: 1_000, passed: true });
    expect(parsed.snapshot.lines.reduce((s, l) => s + l.share, 0)).toBeCloseTo(1, 5);
    expect(parsed.snapshot.source).toEqual({ document: "ITR", filingReferenceDate: "2026-06-30", filingVersion: 1, comparative: false });
  });

  it("accepts verified label variants (1T25 'Tecnologia & Serviços', 'Reversão de Provisão', pre-'(Trillia)')", async () => {
    const parsed = parseSegmentPeriod(filingOf(await filings(), "ITR", "2025-03-31"),
      { periodStart: "2025-01-01", periodEnd: "2025-03-31", periodKind: "quarter", comparative: false });
    expect(parsed.status).toBe("ok");
    if (parsed.status !== "ok") return;
    expect(parsed.snapshot.lines.map(l => l.label)).toEqual(["Mercados", "Soluções Analíticas de Dados", "Soluções para o Mercado de Capitais", "Tecnologia & Serviços", "Reversão de Provisão"]);
    expect(parsed.snapshot.lines.find(l => l.segmentId === "tecnologia_e_plataformas")!.value).toBe(459_516 * K);
  });

  it("the pre-2025 taxonomy is recognised and skipped, never back-cast", async () => {
    const parsed = parseSegmentPeriod(filingOf(await filings(), "DFP", "2024-12-31"),
      { periodStart: "2024-01-01", periodEnd: "2024-12-31", periodKind: "fy", comparative: false });
    expect(parsed).toMatchObject({ status: "legacy_taxonomy" });
  });

  it("an unknown segment label fails closed", async () => {
    const f = filingOf(await filings(), "ITR", "2026-06-30");
    f.rows.filter(r => r.code === "3.01.03").forEach(r => { r.description = "Novos Negócios"; });
    expect(parseSegmentPeriod(f, Q2_26)).toMatchObject({ status: "invalid", reason: expect.stringMatching(/unrecognised segment line 3\.01\.03 "Novos Negócios"/) });
  });

  it("a snapshot whose lines do not add up to 3.01 is rejected whole", async () => {
    const f = filingOf(await filings(), "ITR", "2026-06-30");
    f.rows.filter(r => r.code === "3.01.04" && r.periodStart === "2026-04-01").forEach(r => { r.value += 5 * K; });
    expect(parseSegmentPeriod(f, Q2_26)).toMatchObject({ status: "invalid", reason: expect.stringMatching(/≠ gross revenue/) });
  });
});

describe("approved segment periods — no segment TTM", () => {
  it("history: FY2024 (restated in DFP 2025), FY2025, latest YTD and latest quarter", async () => {
    const sel = selectSegmentHistory(collectSegmentCandidates(await filings()), "2026-06-30");
    expect(sel.latestValid).toBe(true);
    expect(sel.issues).toEqual([]);
    expect(sel.snapshots.map(s => `${s.periodKind} ${s.periodStart}..${s.periodEnd} ${s.source.document}@${s.source.filingReferenceDate}${s.source.comparative ? " (comparative)" : ""}`)).toEqual([
      "fy 2024-01-01..2024-12-31 DFP@2025-12-31 (comparative)",
      "fy 2025-01-01..2025-12-31 DFP@2025-12-31",
      "ytd 2026-01-01..2026-06-30 ITR@2026-06-30",
      "quarter 2026-04-01..2026-06-30 ITR@2026-06-30",
    ]);
    const fy24 = sel.snapshots[0];
    expect(fy24.lines.find(l => l.segmentId === "mercados")!.value).toBe(7_195_644 * K);
    expect(fy24.reconciliation.grossRevenue).toBe(10_572_738 * K);
  });

  it("B3 restates comparative allocations — why segments are never combined across filings", async () => {
    const fs = await filings();
    const tp = (f: RawFiling, comparative: boolean) => f.rows.find(r =>
      r.code === "3.01.04" && r.periodStart === "2025-01-01" && r.periodEnd === "2025-06-30" && r.order === (comparative ? "comparative" : "current"))!.value;
    expect(tp(filingOf(fs, "ITR", "2025-06-30"), false)).toBe(920_068 * K);   // as filed in 2T25
    expect(tp(filingOf(fs, "ITR", "2026-06-30"), true)).toBe(913_549 * K);    // restated in 2T26
  });

  it("the module exposes no TTM/rolling segment computation", () => {
    expect(Object.keys(segments).filter(k => /ttm|trailing|rolling|annuali[sz]e/i.test(k))).toEqual([]);
  });

  it("interim comparatives are never kept; the current mix is one period of the latest filing", async () => {
    const candidates = collectSegmentCandidates(await filings());
    const sel = selectSegmentHistory(candidates, "2026-06-30");
    expect(sel.snapshots.filter(s => s.periodKind !== "fy" && s.source.comparative)).toEqual([]);
    const current = currentSegmentSnapshot(sel.snapshots, "2026-06-30")!;
    expect([current.periodKind, current.periodStart, current.periodEnd]).toEqual(["quarter", "2026-04-01", "2026-06-30"]);
    expect(currentSegmentSnapshot(sel.snapshots, "2025-12-31")!.periodKind).toBe("fy");
  });

  it("a taxonomy change in the latest filing invalidates only the latest block", async () => {
    const fs = (await filings()).map(f => structuredClone(f));
    fs.find(f => f.filingReferenceDate === "2026-06-30")!.rows
      .filter(r => r.code === "3.01.01" && r.order === "current").forEach(r => { r.description = "Mercados e Infraestrutura"; });
    const sel = selectSegmentHistory(collectSegmentCandidates(fs), "2026-06-30");
    expect(sel.latestValid).toBe(false);
    expect(sel.snapshots.map(s => s.periodEnd)).toEqual(["2024-12-31", "2025-12-31"]);
    expect(currentSegmentSnapshot(sel.snapshots, "2026-06-30")).toBeNull();
  });
});
