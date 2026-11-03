import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { zipSync, strToU8 } from "fflate";
import {
  clearDfpCaches,
  getAnnualDfpFinancials,
  getDfpCacheStats,
  releaseDfpCompanyCache,
} from "./dfp-client";
import { fetchCvmDocuments, releaseCvmDocumentsCache } from "./documents-client";

// Tiny synthetic DFP year ZIP with two companies (CD_CVM 111 and 222).

const HEADER =
  "CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;GRUPO_DFP;MOEDA;ESCALA_MOEDA;ORDEM_EXERC;DT_INI_EXERC;DT_FIM_EXERC;CD_CONTA;DS_CONTA;VL_CONTA;ST_CONTA_FIXA";

function statementCsv(year: number, grupo: string, code: string, account: string): string {
  const row = (cvm: string, name: string, value: number) =>
    `00.000.000/0001-00;${year}-12-31;1;${name};${cvm};${grupo};REAL;MIL;ÚLTIMO;${year}-01-01;${year}-12-31;${code};${account};${value};S`;
  return [HEADER, row("111", "COMPANHIA ALFA S.A.", 1000), row("222", "COMPANHIA BETA S.A.", 2000)].join("\n");
}

function catalogCsv(year: number): string {
  return [
    "CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;CATEG_DOC;ID_DOC;DT_RECEB;LINK_DOC",
    `00.000.000/0001-00;${year}-12-31;1;COMPANHIA ALFA S.A.;111;DFP;9001;${year}-03-01;https://example.invalid/9001`,
  ].join("\n");
}

// CVM files are Latin-1; the client decodes them as such.
const latin1 = (text: string) => strToU8(text, true);

function yearZip(year: number): Uint8Array {
  return zipSync({
    [`dfp_cia_aberta_DRE_con_${year}.csv`]: latin1(statementCsv(year, "DF Consolidado - Demonstração do Resultado", "3.01", "Receita de Venda de Bens e/ou Serviços")),
    [`dfp_cia_aberta_BPA_con_${year}.csv`]: latin1(statementCsv(year, "DF Consolidado - Balanço Patrimonial Ativo", "1.01.01", "Caixa e Equivalentes de Caixa")),
    [`dfp_cia_aberta_BPP_con_${year}.csv`]: latin1(statementCsv(year, "DF Consolidado - Balanço Patrimonial Passivo", "2.01.04", "Empréstimos e Financiamentos")),
    [`dfp_cia_aberta_DFC_MI_con_${year}.csv`]: latin1(statementCsv(year, "DF Consolidado - Demonstração do Fluxo de Caixa (Método Indireto)", "6.01", "Caixa Líquido Atividades Operacionais")),
    [`dfp_cia_aberta_${year}.csv`]: latin1(catalogCsv(year)),
  });
}

let fetchCalls = 0;
let gate: Promise<void> | null = null;

function stubFetch(): void {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    fetchCalls++;
    if (gate) await gate;
    const year = Number(/(\d{4})\.zip$/.exec(url)?.[1]);
    const bytes = yearZip(year);
    return { ok: true, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  }));
}

beforeEach(() => {
  clearDfpCaches();
  fetchCalls = 0;
  gate = null;
  stubFetch();
  vi.stubEnv("CVM_DFP_INNER_CONCURRENCY", "");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("releaseDfpCompanyCache", () => {
  it("releases company A without touching company B or the shared ZIPs", async () => {
    await getAnnualDfpFinancials("ALFA3", "111", [2023, 2024]);
    await getAnnualDfpFinancials("BETA3", "222", [2023, 2024]);
    // 2 years × 4 statement files per company (DFC_MD is absent from the ZIP
    // and therefore not cached).
    expect(getDfpCacheStats()).toMatchObject({ zipYears: [2023, 2024], rowEntries: 16, financialsEntries: 2 });

    const result = releaseDfpCompanyCache("ALFA3", "111");
    expect(result).toEqual({ released: true, rowEntries: 8 });
    expect(getDfpCacheStats()).toMatchObject({ zipYears: [2023, 2024], rowEntries: 8, financialsEntries: 1 });

    // B is still served from its caches; A is recomputed from the kept ZIPs.
    const callsBefore = fetchCalls;
    const beta = await getAnnualDfpFinancials("BETA3", "222", [2023, 2024]);
    const alfa = await getAnnualDfpFinancials("ALFA3", "111", [2023, 2024]);
    expect(beta.map(f => f.fiscalYear)).toEqual([2023, 2024]);
    expect(alfa.map(f => f.fiscalYear)).toEqual([2023, 2024]);
    expect(fetchCalls).toBe(callsBefore);
  });

  it("is a no-op for an unknown company", () => {
    expect(releaseDfpCompanyCache("XXXX3", "999")).toEqual({ released: false, rowEntries: 0 });
  });

  it("does not release a ticker whose pipeline is still in flight", async () => {
    let open!: () => void;
    gate = new Promise<void>(r => { open = r; });
    const pending = getAnnualDfpFinancials("ALFA3", "111", [2024]);
    expect(getDfpCacheStats().inflightTickers).toBe(1);
    expect(releaseDfpCompanyCache("ALFA3", "111")).toEqual({ released: false, rowEntries: 0 });
    open();
    await pending;
    expect(getDfpCacheStats().financialsEntries).toBe(1);
  });

  it("keeps row entries shared with another in-flight ticker of the same company", async () => {
    await getAnnualDfpFinancials("ALFA4", "111", [2024]);
    let open!: () => void;
    gate = new Promise<void>(r => { open = r; });
    expireZipCache();
    const pending = getAnnualDfpFinancials("ALFA3", "111", [2024]);
    const result = releaseDfpCompanyCache("ALFA4", "111");
    expect(result.rowEntries).toBe(0);
    open();
    await pending;
  });
});

// Advances Date.now past the 1 h ZIP TTL (but within the 24 h row/financials
// TTL), so the next new pipeline waits on the gated download.
function expireZipCache(): void {
  expect(getDfpCacheStats().zipYears.length).toBeGreaterThan(0);
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 2 * 60 * 60 * 1000);
}

describe("CVM_DFP_INNER_CONCURRENCY", () => {
  it("produces the same financials in bounded mode", async () => {
    const parallel = await getAnnualDfpFinancials("ALFA3", "111", [2022, 2023, 2024]);
    clearDfpCaches();
    vi.stubEnv("CVM_DFP_INNER_CONCURRENCY", "1");
    const bounded = await getAnnualDfpFinancials("ALFA3", "111", [2022, 2023, 2024]);
    expect(bounded).toEqual(parallel);
  });

  it("rejects an invalid value", async () => {
    vi.stubEnv("CVM_DFP_INNER_CONCURRENCY", "zero");
    await expect(getAnnualDfpFinancials("ALFA3", "111", [2024])).rejects.toThrow(/positive integer/);
  });
});

describe("releaseCvmDocumentsCache", () => {
  it("drops one company's cached documents", async () => {
    await fetchCvmDocuments("ALFA3", "111");
    expect(releaseCvmDocumentsCache("111")).toBe(true);
    expect(releaseCvmDocumentsCache("111")).toBe(false);
    expect(releaseCvmDocumentsCache("222")).toBe(false);
  });
});
