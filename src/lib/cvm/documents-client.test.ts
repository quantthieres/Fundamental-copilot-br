import { describe, it, expect } from "vitest";
import {
  classifyDocumentType,
  parseCvmDate,
  normalizeEnetHit,
  sortDocumentsDesc,
  parseCatalogCsv,
  normalizeCatalogRow,
} from "./documents-client";
import type { CatalogRow } from "./documents-client";
import type { CvmDocument } from "./documents-types";

// ─── classifyDocumentType ─────────────────────────────────────────────────────

describe("classifyDocumentType", () => {
  it("maps DFP to friendly label", () => {
    expect(classifyDocumentType("DFP")).toBe("Demonstrações Anuais");
  });

  it("maps ITR to friendly label", () => {
    expect(classifyDocumentType("ITR")).toBe("Resultado Trimestral");
  });

  it("maps FRE to friendly label", () => {
    expect(classifyDocumentType("FRE")).toBe("Formulário de Referência");
  });

  it("maps Fato Relevante to friendly label", () => {
    expect(classifyDocumentType("Fato Relevante")).toBe("Fato Relevante");
  });

  it("maps AGO to Assembleia", () => {
    expect(classifyDocumentType("AGO")).toBe("Assembleia");
  });

  it("maps Aviso aos Acionistas to Comunicado", () => {
    expect(classifyDocumentType("Aviso aos Acionistas")).toBe("Comunicado");
  });

  it("returns generic label for unknown codes", () => {
    expect(classifyDocumentType("XYZ_UNKNOWN")).toBe("Documento CVM");
  });

  it("returns generic label for undefined", () => {
    expect(classifyDocumentType(undefined)).toBe("Documento CVM");
  });

  it("returns generic label for empty string", () => {
    expect(classifyDocumentType("")).toBe("Documento CVM");
  });
});

// ─── parseCvmDate ─────────────────────────────────────────────────────────────

describe("parseCvmDate", () => {
  it("parses a plain ISO date", () => {
    expect(parseCvmDate("2024-03-14")).toBe("2024-03-14");
  });

  it("strips time component from ISO timestamp", () => {
    expect(parseCvmDate("2024-03-14T19:15:00")).toBe("2024-03-14");
  });

  it("strips time with timezone offset", () => {
    expect(parseCvmDate("2024-03-14T00:00:00-03:00")).toBe("2024-03-14");
  });

  it("returns null for undefined", () => {
    expect(parseCvmDate(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseCvmDate("")).toBeNull();
  });

  it("returns null for invalid date text", () => {
    expect(parseCvmDate("not-a-date")).toBeNull();
  });

  it("returns null for year before 2000", () => {
    expect(parseCvmDate("1999-12-31")).toBeNull();
  });

  it("returns null for NaN date", () => {
    expect(parseCvmDate("2024-99-99")).toBeNull();
  });
});

// ─── normalizeEnetHit ─────────────────────────────────────────────────────────

describe("normalizeEnetHit", () => {
  const validHit = {
    _id: "abc123",
    _source: {
      CodCvm: "5410",
      NomPessoa: "WEG S.A.",
      NumProtocolo: "001234",
      DtRecebimento: "2024-03-14T19:15:00",
      CodTipoDocumento: "DFP",
      DescTipoDocumento: "Demonstrações Financeiras Padronizadas",
      Assunto: "Demonstrações Financeiras Padronizadas exercício 31/12/2023",
      NumSequencia: "789012",
      NumVersao: "1",
    },
  };

  it("normalizes a valid hit", () => {
    const doc = normalizeEnetHit(validHit);
    expect(doc).not.toBeNull();
    expect(doc!.date).toBe("2024-03-14");
    expect(doc!.category).toBe("Demonstrações Anuais");
    expect(doc!.source).toBe("CVM");
    expect(doc!.title).toContain("Demonstrações Financeiras");
  });

  it("sets id from NumSequencia", () => {
    const doc = normalizeEnetHit(validHit);
    expect(doc!.id).toBe("789012");
  });

  it("constructs a RAD viewer URL from NumSequencia", () => {
    const doc = normalizeEnetHit(validHit);
    expect(doc!.url).toContain("frmVisualizadorExt.aspx");
    expect(doc!.url).toContain("789012");
  });

  it("returns null when date is missing", () => {
    const hit = { _id: "x", _source: { CodTipoDocumento: "DFP" } };
    expect(normalizeEnetHit(hit)).toBeNull();
  });

  it("returns null when date is invalid", () => {
    const hit = {
      _id: "x",
      _source: { DtRecebimento: "not-a-date", CodTipoDocumento: "DFP" },
    };
    expect(normalizeEnetHit(hit)).toBeNull();
  });

  it("returns null for null input", () => {
    expect(normalizeEnetHit(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(normalizeEnetHit(undefined)).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(normalizeEnetHit("string")).toBeNull();
    expect(normalizeEnetHit(42)).toBeNull();
  });

  it("does not set url when NumSequencia is absent", () => {
    const hit = {
      _id: "x",
      _source: {
        DtRecebimento: "2024-01-10",
        CodTipoDocumento: "ITR",
        DescTipoDocumento: "Informações Trimestrais",
      },
    };
    const doc = normalizeEnetHit(hit);
    expect(doc).not.toBeNull();
    expect(doc!.url).toBeUndefined();
  });

  it("does not use a non-http LinkDoc as url", () => {
    const hit = {
      _id: "y",
      _source: {
        DtRecebimento: "2024-01-10",
        CodTipoDocumento: "FRE",
        DescTipoDocumento: "Formulário de Referência",
        LinkDoc: "javascript:void(0)",
      },
    };
    const doc = normalizeEnetHit(hit);
    expect(doc!.url).toBeUndefined();
  });

  it("accepts an http LinkDoc as url when NumSequencia is absent", () => {
    const hit = {
      _id: "z",
      _source: {
        DtRecebimento: "2024-01-10",
        CodTipoDocumento: "FRE",
        LinkDoc: "https://www.rad.cvm.gov.br/ENET/doc.pdf",
      },
    };
    const doc = normalizeEnetHit(hit);
    expect(doc!.url).toBe("https://www.rad.cvm.gov.br/ENET/doc.pdf");
  });

  it("falls back to DescTipoDocumento for title when Assunto is absent", () => {
    const hit = {
      _id: "t",
      _source: {
        DtRecebimento: "2024-01-10",
        CodTipoDocumento: "ITR",
        DescTipoDocumento: "Informações Trimestrais",
      },
    };
    const doc = normalizeEnetHit(hit);
    expect(doc!.title).toBe("Informações Trimestrais");
  });

  it("falls back to category label when both Assunto and DescTipoDocumento are absent", () => {
    const hit = {
      _id: "u",
      _source: {
        DtRecebimento: "2024-01-10",
        CodTipoDocumento: "DFP",
      },
    };
    const doc = normalizeEnetHit(hit);
    expect(doc!.title).toBe("Demonstrações Anuais");
  });
});

// ─── sortDocumentsDesc ────────────────────────────────────────────────────────

describe("sortDocumentsDesc", () => {
  function doc(date: string): CvmDocument {
    return { id: date, date, category: "Documento CVM", title: "Test", source: "CVM" };
  }

  it("sorts newest first", () => {
    const input = [doc("2023-01-01"), doc("2024-06-15"), doc("2024-01-10")];
    const result = sortDocumentsDesc(input);
    expect(result.map(d => d.date)).toEqual(["2024-06-15", "2024-01-10", "2023-01-01"]);
  });

  it("returns empty array for empty input", () => {
    expect(sortDocumentsDesc([])).toEqual([]);
  });

  it("does not mutate the original array", () => {
    const input = [doc("2023-01-01"), doc("2024-06-15")];
    const copy = [...input];
    sortDocumentsDesc(input);
    expect(input).toEqual(copy);
  });

  it("handles single item", () => {
    const input = [doc("2024-05-01")];
    expect(sortDocumentsDesc(input)).toEqual(input);
  });
});

// ─── parseCatalogCsv ─────────────────────────────────────────────────────────

// Realistic CSV sample matching the actual CVM format (CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;CATEG_DOC;ID_DOC;DT_RECEB;LINK_DOC)
const SAMPLE_CSV = [
  "CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;CATEG_DOC;ID_DOC;DT_RECEB;LINK_DOC",
  "84.429.695/0001-11;2024-12-31;1;WEG S.A.;005410;DFP;145000;2025-02-14;http://www.rad.cvm.gov.br/ENETCONSULTA/frmDownloadDocumento.aspx?CodigoInstituicao=1&NumeroSequencialDocumento=145000",
  "33.000.167/0001-01;2024-12-31;1;PETROBRAS;009512;DFP;145001;2025-02-20;http://www.rad.cvm.gov.br/ENETCONSULTA/frmDownloadDocumento.aspx?CodigoInstituicao=1&NumeroSequencialDocumento=145001",
  "84.429.695/0001-11;2024-12-31;2;WEG S.A.;005410;DFP;145002;2025-03-01;http://www.rad.cvm.gov.br/ENETCONSULTA/frmDownloadDocumento.aspx?CodigoInstituicao=1&NumeroSequencialDocumento=145002",
  "",
].join("\n");

describe("parseCatalogCsv", () => {
  it("returns rows matching the given CVM code", () => {
    const rows = parseCatalogCsv(SAMPLE_CSV, "5410");
    expect(rows).toHaveLength(2); // both WEG rows
    expect(rows.every(r => parseInt(r.cdCvm, 10) === 5410)).toBe(true);
  });

  it("handles zero-padded CVM codes in CSV (int comparison)", () => {
    // CSV stores "005410", map stores "5410" — must match
    const rows = parseCatalogCsv(SAMPLE_CSV, "5410");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("does not return rows for a different CVM code", () => {
    const rows = parseCatalogCsv(SAMPLE_CSV, "9512");
    expect(rows).toHaveLength(1);
    expect(rows[0].nomCia).toBe("PETROBRAS");
  });

  it("returns empty array for empty text", () => {
    expect(parseCatalogCsv("", "5410")).toEqual([]);
  });

  it("returns empty array for header-only CSV", () => {
    const header = "CNPJ_CIA;DT_REFER;VERSAO;DENOM_CIA;CD_CVM;CATEG_DOC;ID_DOC;DT_RECEB;LINK_DOC";
    expect(parseCatalogCsv(header, "5410")).toEqual([]);
  });

  it("returns empty array for invalid CVM code", () => {
    expect(parseCatalogCsv(SAMPLE_CSV, "NaN")).toEqual([]);
  });

  it("skips lines with fewer than 9 columns", () => {
    const broken = "CNPJ_CIA;DT_REFER\n84.429.695;2024-12-31";
    expect(parseCatalogCsv(broken, "5410")).toEqual([]);
  });

  it("maps all fields correctly", () => {
    const rows = parseCatalogCsv(SAMPLE_CSV, "5410");
    const first = rows[0];
    expect(first.dtRefer).toBe("2024-12-31");
    expect(first.categDoc).toBe("DFP");
    expect(first.idDoc).toBe("145000");
    expect(first.dtReceb).toBe("2025-02-14");
    expect(first.linkDoc).toContain("145000");
  });
});

// ─── normalizeCatalogRow ─────────────────────────────────────────────────────

function makeRow(overrides: Partial<CatalogRow> = {}): CatalogRow {
  return {
    cnpjCia:  "84.429.695/0001-11",
    dtRefer:  "2024-12-31",
    versao:   1,
    nomCia:   "WEG S.A.",
    cdCvm:    "005410",
    categDoc: "DFP",
    idDoc:    "145000",
    dtReceb:  "2025-02-14",
    linkDoc:  "http://www.rad.cvm.gov.br/ENETCONSULTA/frmDownloadDocumento.aspx?CodigoInstituicao=1&NumeroSequencialDocumento=145000",
    ...overrides,
  };
}

describe("normalizeCatalogRow", () => {
  it("returns a CvmDocument for a valid row", () => {
    const doc = normalizeCatalogRow(makeRow());
    expect(doc).not.toBeNull();
    expect(doc!.id).toBe("145000");
    expect(doc!.date).toBe("2025-02-14");
    expect(doc!.category).toBe("Demonstrações Anuais");
    expect(doc!.type).toBe("DFP");
    expect(doc!.source).toBe("CVM");
  });

  it("includes the http link as url", () => {
    const doc = normalizeCatalogRow(makeRow());
    expect(doc!.url).toContain("145000");
    expect(doc!.url).toMatch(/^http/);
  });

  it("does not set url for empty linkDoc", () => {
    const doc = normalizeCatalogRow(makeRow({ linkDoc: "" }));
    expect(doc).not.toBeNull();
    expect(doc!.url).toBeUndefined();
  });

  it("does not set url for non-http linkDoc", () => {
    const doc = normalizeCatalogRow(makeRow({ linkDoc: "javascript:void(0)" }));
    expect(doc!.url).toBeUndefined();
  });

  it("returns null for invalid dtReceb", () => {
    expect(normalizeCatalogRow(makeRow({ dtReceb: "not-a-date" }))).toBeNull();
  });

  it("returns null for missing dtReceb", () => {
    expect(normalizeCatalogRow(makeRow({ dtReceb: "" }))).toBeNull();
  });

  it("returns null for very old dtReceb (outside lookback window)", () => {
    // 2019 is well outside 18 months from now (2026)
    expect(normalizeCatalogRow(makeRow({ dtReceb: "2019-01-01" }))).toBeNull();
  });

  it("builds title from category + fiscal year", () => {
    const doc = normalizeCatalogRow(makeRow());
    expect(doc!.title).toBe("Demonstrações Anuais — exercício 2024");
  });

  it("uses idDoc as the document id", () => {
    const doc = normalizeCatalogRow(makeRow({ idDoc: "999888" }));
    expect(doc!.id).toBe("999888");
  });

  it("falls back to composite id when idDoc is empty", () => {
    const doc = normalizeCatalogRow(makeRow({ idDoc: "" }));
    expect(doc).not.toBeNull();
    expect(doc!.id).toBeTruthy();
  });
});
