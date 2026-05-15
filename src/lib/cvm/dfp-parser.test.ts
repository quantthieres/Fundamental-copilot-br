import { describe, it, expect } from "vitest";
import { parseDfpCsv, parseDfpCsvForCompanies } from "./dfp-parser";

// ─── CSV helpers ──────────────────────────────────────────────────────────────

const HEADER = "CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;GRUPO_DFP;ESCALA_MOEDA;ORDEM_EXERC;DT_INI_EXERC;DT_FIM_EXERC;CD_CONTA;DS_CONTA;VL_CONTA";

type RowOpts = {
  cdCvm?:      string;
  versao?:     string;
  denomCia?:   string;
  grupoDfp?:   string;
  escala?:     string;
  ordem?:      string;
  dtIni?:      string;
  dtFim?:      string;
  cdConta?:    string;
  dsConta?:    string;
  vlConta?:    string;
};

function csvRow({
  cdCvm    = "009512",
  versao   = "1",
  denomCia = "TEST SA",
  grupoDfp = "DF Consolidado - Demonstração do Resultado",
  escala   = "MIL",
  ordem    = "ÚLTIMO",
  dtIni    = "2024-01-01",
  dtFim    = "2024-06-30",
  cdConta  = "3.01",
  dsConta  = "Receita",
  vlConta  = "1000",
}: RowOpts = {}): string {
  // CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;GRUPO_DFP;ESCALA_MOEDA;ORDEM_EXERC;DT_INI_EXERC;DT_FIM_EXERC;CD_CONTA;DS_CONTA;VL_CONTA
  return `11.111.111/0001-11;${dtFim};${versao};${denomCia};${cdCvm};${grupoDfp};${escala};${ordem};${dtIni};${dtFim};${cdConta};${dsConta};${vlConta}`;
}

function csv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n");
}

// ─── parseDfpCsv — YTD selection (Pass 3) ────────────────────────────────────

describe("parseDfpCsv — YTD row selection (Pass 3)", () => {
  it("selects the YTD row (earliest DT_INI) when two ÚLTIMO rows share the same DT_FIM", () => {
    // Q2 filing: YTD row (Jan–Jun, value 9000) and quarterly row (Apr–Jun, value 4500)
    const ytdRow = csvRow({ dtIni: "2024-01-01", dtFim: "2024-06-30", vlConta: "9000" });
    const qtrRow = csvRow({ dtIni: "2024-04-01", dtFim: "2024-06-30", vlConta: "4500" });

    const result = parseDfpCsv(csv(ytdRow, qtrRow), "9512", "DRE");
    expect(result).toHaveLength(1);
    // MIL scale → multiply by 1000; 9000 * 1000 = 9_000_000
    expect(result[0].value).toBe(9_000_000);
  });

  it("excludes the quarter-specific row (later DT_INI)", () => {
    const ytdRow = csvRow({ dtIni: "2024-01-01", dtFim: "2024-06-30", vlConta: "9000" });
    const qtrRow = csvRow({ dtIni: "2024-04-01", dtFim: "2024-06-30", vlConta: "4500" });

    const result = parseDfpCsv(csv(ytdRow, qtrRow), "9512", "DRE");
    // Should NOT contain 4500*1000
    expect(result.some(r => r.value === 4_500_000)).toBe(false);
  });

  it("order-independent: YTD row wins even when quarter-specific row appears first in CSV", () => {
    const ytdRow = csvRow({ dtIni: "2024-01-01", dtFim: "2024-06-30", vlConta: "9000" });
    const qtrRow = csvRow({ dtIni: "2024-04-01", dtFim: "2024-06-30", vlConta: "4500" });

    const resultQtrFirst = parseDfpCsv(csv(qtrRow, ytdRow), "9512", "DRE");
    expect(resultQtrFirst).toHaveLength(1);
    expect(resultQtrFirst[0].value).toBe(9_000_000);
  });

  it("single row (Q1 or DFP annual): Pass 3 is a no-op, row is preserved", () => {
    const singleRow = csvRow({ dtIni: "2024-01-01", dtFim: "2024-03-31", vlConta: "5000" });
    const result = parseDfpCsv(csv(singleRow), "9512", "DRE");
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(5_000_000);
  });

  it("keeps YTD rows for different periods independently", () => {
    // Q1 and Q2, each with a YTD and a quarterly row
    const q1 = csvRow({ dtIni: "2024-01-01", dtFim: "2024-03-31", vlConta: "4000" });
    const q2ytd = csvRow({ dtIni: "2024-01-01", dtFim: "2024-06-30", vlConta: "9000" });
    const q2qtr = csvRow({ dtIni: "2024-04-01", dtFim: "2024-06-30", vlConta: "5000" });

    const result = parseDfpCsv(csv(q1, q2ytd, q2qtr), "9512", "DRE");
    expect(result).toHaveLength(2);

    const q1r = result.find(r => r.periodEndDate === "2024-03-31");
    const q2r = result.find(r => r.periodEndDate === "2024-06-30");
    expect(q1r?.value).toBe(4_000_000);
    expect(q2r?.value).toBe(9_000_000);
  });
});

// ─── parseDfpCsv — VERSAO deduplication (Pass 2) ──────────────────────────────

describe("parseDfpCsv — VERSAO deduplication (Pass 2)", () => {
  it("keeps only the highest VERSAO per DT_FIM_EXERC", () => {
    const v1 = csvRow({ versao: "1", vlConta: "8000", dtIni: "2024-01-01" });
    const v2 = csvRow({ versao: "2", vlConta: "8500", dtIni: "2024-01-01" });
    const result = parseDfpCsv(csv(v1, v2), "9512", "DRE");
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(8_500_000);
  });

  it("handles VERSAO deduplication before Pass 3 (highest version, then earliest DT_INI)", () => {
    // Both v2 rows survive pass 2 (same highest versao), then pass 3 picks earliest DT_INI
    const v1ytd = csvRow({ versao: "1", dtIni: "2024-01-01", vlConta: "7000" });
    const v2ytd = csvRow({ versao: "2", dtIni: "2024-01-01", vlConta: "9000" });
    const v2qtr = csvRow({ versao: "2", dtIni: "2024-04-01", vlConta: "4500" });
    const result = parseDfpCsv(csv(v1ytd, v2ytd, v2qtr), "9512", "DRE");
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(9_000_000);
  });
});

// ─── parseDfpCsv — PENÚLTIMO rows excluded ────────────────────────────────────

describe("parseDfpCsv — PENÚLTIMO rows excluded", () => {
  it("ignores rows where ORDEM_EXERC is PENÚLTIMO", () => {
    const ultimo   = csvRow({ ordem: "ÚLTIMO",   vlConta: "9000" });
    const penult   = csvRow({ ordem: "PENÚLTIMO", vlConta: "9999" });
    const result = parseDfpCsv(csv(ultimo, penult), "9512", "DRE");
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(9_000_000);
  });
});

// ─── parseDfpCsv — MIL scale conversion ──────────────────────────────────────

describe("parseDfpCsv — MIL scale conversion", () => {
  it("multiplies MIL values by 1000", () => {
    const r = csvRow({ escala: "MIL", vlConta: "500" });
    const result = parseDfpCsv(csv(r), "9512", "DRE");
    expect(result[0].value).toBe(500_000);
  });

  it("does not multiply UNIDADE values", () => {
    const r = csvRow({ escala: "UNIDADE", vlConta: "500" });
    const result = parseDfpCsv(csv(r), "9512", "DRE");
    expect(result[0].value).toBe(500);
  });
});

// ─── parseDfpCsvForCompanies — YTD selection (Pass 3) ────────────────────────

describe("parseDfpCsvForCompanies — YTD row selection (Pass 3)", () => {
  it("selects YTD row for each company independently", () => {
    const c1ytd = csvRow({ cdCvm: "009512", dtIni: "2024-01-01", dtFim: "2024-06-30", vlConta: "9000" });
    const c1qtr = csvRow({ cdCvm: "009512", dtIni: "2024-04-01", dtFim: "2024-06-30", vlConta: "4500" });
    const c2ytd = csvRow({ cdCvm: "005410", dtIni: "2024-01-01", dtFim: "2024-06-30", vlConta: "3000", denomCia: "OTHER SA" });
    const c2qtr = csvRow({ cdCvm: "005410", dtIni: "2024-04-01", dtFim: "2024-06-30", vlConta: "1500", denomCia: "OTHER SA" });

    const result = parseDfpCsvForCompanies(
      csv(c1ytd, c1qtr, c2ytd, c2qtr),
      new Set(["9512", "5410"]),
      "DRE",
    );

    expect(result.get("009512")).toHaveLength(1);
    expect(result.get("009512")![0].value).toBe(9_000_000);

    expect(result.get("005410")).toHaveLength(1);
    expect(result.get("005410")![0].value).toBe(3_000_000);
  });

  it("returns empty map when cvmCodes is empty", () => {
    const result = parseDfpCsvForCompanies(csv(), new Set(), "DRE");
    expect(result.size).toBe(0);
  });

  it("excludes companies not in the requested set", () => {
    const c1 = csvRow({ cdCvm: "009512", dtIni: "2024-01-01", vlConta: "9000" });
    const c2 = csvRow({ cdCvm: "005410", dtIni: "2024-01-01", vlConta: "3000", denomCia: "OTHER SA" });
    const result = parseDfpCsvForCompanies(csv(c1, c2), new Set(["9512"]), "DRE");
    expect(result.has("009512")).toBe(true);
    expect(result.has("005410")).toBe(false);
  });

  it("keeps highest VERSAO before YTD selection", () => {
    const v1 = csvRow({ cdCvm: "009512", versao: "1", dtIni: "2024-01-01", dtFim: "2024-06-30", vlConta: "8000" });
    const v2 = csvRow({ cdCvm: "009512", versao: "2", dtIni: "2024-01-01", dtFim: "2024-06-30", vlConta: "9000" });
    const v2q = csvRow({ cdCvm: "009512", versao: "2", dtIni: "2024-04-01", dtFim: "2024-06-30", vlConta: "4500" });
    const result = parseDfpCsvForCompanies(csv(v1, v2, v2q), new Set(["9512"]), "DRE");
    expect(result.get("009512")).toHaveLength(1);
    expect(result.get("009512")![0].value).toBe(9_000_000);
  });
});

// ─── parseDfpCsv — Q4 de-accumulation does not go negative ───────────────────
// This test validates the end-to-end scenario by checking that parseDfpCsv
// produces the correct YTD Q3 value — the downstream itr-quarterly module
// then computes Q4 = annual - Q3_ytd, so a correct Q3_ytd is the critical input.

describe("parseDfpCsv — Q3 YTD value is correct (enabling non-negative Q4)", () => {
  it("Q3 YTD value is not inflated by the quarterly row sum", () => {
    // Annual DFP revenue = 20 B (BRL). Q3 YTD = 15 B. Expected Q4 = 5 B.
    // Without the fix, parser summed YTD+quarterly for Q3: 15B+5B=20B, making Q4=0.
    const q3ytd = csvRow({ dtIni: "2024-01-01", dtFim: "2024-09-30", vlConta: "15000000" });
    const q3qtr = csvRow({ dtIni: "2024-07-01", dtFim: "2024-09-30", vlConta: "5000000" });

    const result = parseDfpCsv(csv(q3ytd, q3qtr), "9512", "DRE");
    expect(result).toHaveLength(1);
    // YTD Q3 = 15_000_000 * 1000 = 15_000_000_000
    expect(result[0].value).toBe(15_000_000_000);
  });
});
