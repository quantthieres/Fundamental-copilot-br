// Server-side only. Parses CVM DFP CSV text into RawCvmStatementRow arrays.
import type { RawCvmStatementRow } from "./types";

// Maps the GRUPO_DFP field from the CSV to our short statementType identifiers.
const GRUPO_TO_STMT: Record<string, string> = {
  "DF Consolidado - Demonstração do Resultado":                          "DRE",
  "DF Consolidado - Balanço Patrimonial Ativo":                         "BPA",
  "DF Consolidado - Balanço Patrimonial Passivo":                       "BPP",
  "DF Consolidado - Demonstração do Fluxo de Caixa (Método Indireto)": "DFC_MI",
  "DF Consolidado - Demonstração do Fluxo de Caixa (Método Direto)":   "DFC_MD",
};

// Pads a CVM code to 6 digits for consistent comparison.
function padCvmCode(code: string): string {
  return code.trim().padStart(6, "0");
}

/**
 * Parses a raw DFP/ITR CSV string (Latin-1 decoded) and returns rows for the
 * given company (matched by cvmCode). The `stmtLabel` parameter is the
 * short statement identifier ("DRE", "BPA", "BPP", "DFC_MI", "DFC_MD")
 * used to tag each returned row's `statementType` field.
 *
 * Only ÚLTIMO rows are kept (current fiscal year, not the PENÚLTIMO
 * comparative). When a company has filed multiple versions (amendments),
 * only the rows belonging to the highest VERSAO are returned.
 *
 * Values in MIL (thousands) scale are multiplied by 1,000 so that
 * `RawCvmStatementRow.value` always represents actual BRL.
 */
export function parseDfpCsv(
  csvText: string,
  cvmCode: string,
  stmtLabel: string,
): RawCvmStatementRow[] {
  const targetCode = padCvmCode(cvmCode);

  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Build a column-index map from the header row.
  const headers = lines[0].split(";");
  const idx = Object.fromEntries(headers.map((h, i) => [h.trim(), i]));

  const COL = {
    cnpj:       idx["CNPJ_CIA"],
    dtRefer:    idx["DT_REFER"],
    versao:     idx["VERSAO"],
    denomCia:   idx["DENOM_CIA"],
    cdCvm:      idx["CD_CVM"],
    grupoDfp:   idx["GRUPO_DFP"],
    escala:     idx["ESCALA_MOEDA"],
    ordemExerc: idx["ORDEM_EXERC"],
    dtFim:      idx["DT_FIM_EXERC"],
    cdConta:    idx["CD_CONTA"],
    dsConta:    idx["DS_CONTA"],
    vlConta:    idx["VL_CONTA"],
  };

  // Verify required columns are present.
  const required = ["CD_CVM", "ORDEM_EXERC", "DT_FIM_EXERC", "CD_CONTA", "DS_CONTA", "VL_CONTA", "VERSAO"];
  for (const col of required) {
    if (!(col in idx)) return [];
  }

  // --- Pass 1: collect ÚLTIMO rows for the target company ----------------
  type IntermRow = {
    versao: number;
    dtFim: string;
    cnpj: string;
    denomCia: string;
    accountCode: string;
    accountName: string;
    value: number;    // in BRL (after scale conversion)
    statementType: string;
  };

  const intermediate: IntermRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const cols = line.split(";");
    if (cols.length < 10) continue;

    const code = padCvmCode(cols[COL.cdCvm] ?? "");
    if (code !== targetCode) continue;

    const ordemExerc = cols[COL.ordemExerc]?.trim();
    if (ordemExerc !== "ÚLTIMO") continue;

    const rawValue = parseFloat(cols[COL.vlConta]?.trim() ?? "0");
    if (isNaN(rawValue)) continue;

    const escala = cols[COL.escala]?.trim().toUpperCase();
    // CVM DFP files use MIL (thousands) scale for most companies.
    // Convert to actual BRL so the normalizer can divide by 1 billion.
    const value = escala === "MIL" ? rawValue * 1_000 : rawValue;

    const grupoRaw = cols[COL.grupoDfp]?.trim() ?? "";
    // Accept both the GRUPO_DFP-mapped type and the explicit stmtLabel.
    const mappedType = GRUPO_TO_STMT[grupoRaw];
    const resolvedType = mappedType ?? stmtLabel;

    intermediate.push({
      versao:        parseInt(cols[COL.versao]?.trim() ?? "0", 10),
      dtFim:         cols[COL.dtFim]?.trim() ?? "",
      cnpj:          cols[COL.cnpj]?.trim() ?? "",
      denomCia:      cols[COL.denomCia]?.trim() ?? "",
      accountCode:   cols[COL.cdConta]?.trim() ?? "",
      accountName:   cols[COL.dsConta]?.trim() ?? "",
      value,
      statementType: resolvedType,
    });
  }

  if (intermediate.length === 0) return [];

  // --- Pass 2: keep only the highest VERSAO per DT_FIM_EXERC --------------
  const maxVersionByPeriod = new Map<string, number>();
  for (const row of intermediate) {
    const current = maxVersionByPeriod.get(row.dtFim) ?? 0;
    maxVersionByPeriod.set(row.dtFim, Math.max(current, row.versao));
  }

  return intermediate
    .filter(row => row.versao === (maxVersionByPeriod.get(row.dtFim) ?? row.versao))
    .map(row => ({
      cvmCode:       targetCode,
      companyName:   row.denomCia,
      statementType: row.statementType,
      accountCode:   row.accountCode,
      accountName:   row.accountName,
      periodEndDate: row.dtFim,
      fiscalYear:    new Date(row.dtFim).getFullYear(),
      value:         row.value,
    }));
}

/**
 * Parses a raw DFP/ITR CSV string and returns rows grouped by CVM code,
 * covering all companies in `cvmCodes` in a single pass.
 *
 * This is more efficient than calling parseDfpCsv once per company when many
 * companies are needed from the same large CSV, because the CSV text is split
 * and iterated only once.
 */
export function parseDfpCsvForCompanies(
  csvText: string,
  cvmCodes: Set<string>,
  stmtLabel: string,
): Map<string, RawCvmStatementRow[]> {
  const result = new Map<string, RawCvmStatementRow[]>();
  if (cvmCodes.size === 0) return result;

  // Normalize all target codes to 6-digit padded form.
  const targetCodes = new Set(Array.from(cvmCodes).map(c => c.trim().padStart(6, "0")));

  const lines = csvText.split(/\r?\n/);
  if (lines.length < 2) return result;

  const headers = lines[0].split(";");
  const idx = Object.fromEntries(headers.map((h, i) => [h.trim(), i]));

  const COL = {
    cnpj:       idx["CNPJ_CIA"],
    versao:     idx["VERSAO"],
    denomCia:   idx["DENOM_CIA"],
    cdCvm:      idx["CD_CVM"],
    grupoDfp:   idx["GRUPO_DFP"],
    escala:     idx["ESCALA_MOEDA"],
    ordemExerc: idx["ORDEM_EXERC"],
    dtFim:      idx["DT_FIM_EXERC"],
    cdConta:    idx["CD_CONTA"],
    dsConta:    idx["DS_CONTA"],
    vlConta:    idx["VL_CONTA"],
  };

  const required = ["CD_CVM", "ORDEM_EXERC", "DT_FIM_EXERC", "CD_CONTA", "DS_CONTA", "VL_CONTA", "VERSAO"];
  for (const col of required) {
    if (!(col in idx)) return result;
  }

  // Intermediate per-company accumulator: cvmCode → rows
  type IntermRow = {
    versao:        number;
    dtFim:         string;
    denomCia:      string;
    accountCode:   string;
    accountName:   string;
    value:         number;
    statementType: string;
  };
  const intermediate = new Map<string, IntermRow[]>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const cols = line.split(";");
    if (cols.length < 10) continue;

    const code = (cols[COL.cdCvm] ?? "").trim().padStart(6, "0");
    if (!targetCodes.has(code)) continue;

    const ordemExerc = cols[COL.ordemExerc]?.trim();
    if (ordemExerc !== "ÚLTIMO") continue;

    const rawValue = parseFloat(cols[COL.vlConta]?.trim() ?? "0");
    if (isNaN(rawValue)) continue;

    const escala = cols[COL.escala]?.trim().toUpperCase();
    const value  = escala === "MIL" ? rawValue * 1_000 : rawValue;

    const grupoRaw    = cols[COL.grupoDfp]?.trim() ?? "";
    const mappedType  = GRUPO_TO_STMT[grupoRaw];
    const resolvedType = mappedType ?? stmtLabel;

    if (!intermediate.has(code)) intermediate.set(code, []);
    intermediate.get(code)!.push({
      versao:        parseInt(cols[COL.versao]?.trim() ?? "0", 10),
      dtFim:         cols[COL.dtFim]?.trim() ?? "",
      denomCia:      cols[COL.denomCia]?.trim() ?? "",
      accountCode:   cols[COL.cdConta]?.trim() ?? "",
      accountName:   cols[COL.dsConta]?.trim() ?? "",
      value,
      statementType: resolvedType,
    });
  }

  // For each company: keep only the highest VERSAO per DT_FIM_EXERC.
  for (const [code, rows] of intermediate) {
    const maxVersionByPeriod = new Map<string, number>();
    for (const row of rows) {
      const cur = maxVersionByPeriod.get(row.dtFim) ?? 0;
      maxVersionByPeriod.set(row.dtFim, Math.max(cur, row.versao));
    }

    result.set(
      code,
      rows
        .filter(row => row.versao === (maxVersionByPeriod.get(row.dtFim) ?? row.versao))
        .map(row => ({
          cvmCode:       code,
          companyName:   row.denomCia,
          statementType: row.statementType,
          accountCode:   row.accountCode,
          accountName:   row.accountName,
          periodEndDate: row.dtFim,
          fiscalYear:    new Date(row.dtFim).getFullYear(),
          value:         row.value,
        })),
    );
  }

  return result;
}
