// Parser for B3's official quarterly-data workbook ("Dados Trimestrais - Nova
// Segmentação", XLSX, B3 RI file manager, category central_de_resultados_dre).
//
// The workbook is bilingual and block-oriented: each block has a PT title
// (column A) and an EN title (column C, or B on the income statement), a PT
// quarter-header row ("2T26") followed by an EN row ("2Q26"), and data rows
// identified by a PT label (A, carried forward over unit rows), a PT unit (B)
// and an EN unit (D). Values are read by sheet name + block title + labels +
// header — never by fixed cell address — from the latest quarter column.
//
// Strict and fail-closed: a missing sheet/block/row, an ambiguous label, a PT
// and EN header disagreeing, blocks disagreeing on the latest quarter, or a
// non-numeric CORE value throws WorkbookLayoutError (the refresh keeps the
// previous validated KPIs). An optional (secondary) value that is missing
// becomes null with an issue — never zero.
//
// Precompute/test-side only. No @/ imports — also used by tsx scripts.

import { normalizeDescription } from "./market-infrastructure-identity";
import type { ExpenseCompositionLine, WorkbookValue } from "./market-infrastructure-types";
import { XlsxWorkbook, columnIndex, type CellValue, type XlsxSheet } from "./xlsx-reader";

export class WorkbookLayoutError extends Error {}

export const WORKBOOK_SHEETS = {
  incomeStatement: "IS (New Seg)",
  derivatives: "Derivatives",
  equities: "Equities & Sec. Lend.",
  fixedIncome: "Fixed Income & Credit",
} as const;

interface QuarterHeader {
  col: string;
  label: string;
  year: number;
  quarter: number;
}

interface Block {
  sheet: XlsxSheet;
  title: string;
  /** Data rows (after the EN header, before the next block header). */
  rows: number[];
  latest: QuarterHeader;
}

interface Layout {
  labelPt: string;
  labelEn: string;
  unitPt?: string;
  unitEn?: string;
  /** Unit rows leave the PT label blank: carry the last label forward. */
  carryLabel: boolean;
}

const KPI_LAYOUT: Layout = { labelPt: "A", labelEn: "C", unitPt: "B", unitEn: "D", carryLabel: true };
const IS_LAYOUT: Layout = { labelPt: "A", labelEn: "B", carryLabel: false };

const norm = (v: CellValue | undefined) => (typeof v === "string" ? normalizeDescription(v) : v === undefined ? "" : String(v));

function quarterHeaders(cells: Map<string, CellValue> | undefined, re: RegExp): QuarterHeader[] {
  const out: QuarterHeader[] = [];
  for (const [col, v] of cells ?? []) {
    const m = typeof v === "string" ? re.exec(v.trim()) : null;
    if (m) out.push({ col, label: v as string, quarter: Number(m[1]), year: 2000 + Number(m[2]) });
  }
  return out;
}

const PT_QUARTER = /^([1-4])T(\d{2})$/;
const EN_QUARTER = /^([1-4])Q(\d{2})$/;

function findBlock(sheet: XlsxSheet, titlePt: string, titleEn: string, layout: Layout): Block {
  const rowNumbers = [...sheet.rows.keys()].sort((a, b) => a - b);
  const titles = rowNumbers.filter(n => {
    const cells = sheet.rows.get(n)!;
    return norm(cells.get(layout.labelPt)) === normalizeDescription(titlePt) && norm(cells.get(layout.labelEn)) === normalizeDescription(titleEn);
  });
  const where = `${sheet.name} / "${titlePt}"`;
  if (titles.length !== 1) throw new WorkbookLayoutError(`${where}: block title found ${titles.length} times`);

  const titleIdx = rowNumbers.indexOf(titles[0]);
  let headerIdx = -1;
  for (let i = titleIdx; i <= Math.min(titleIdx + 3, rowNumbers.length - 2); i++) {
    if (quarterHeaders(sheet.rows.get(rowNumbers[i]), PT_QUARTER).length > 0) { headerIdx = i; break; }
  }
  if (headerIdx < 0) throw new WorkbookLayoutError(`${where}: quarter header row not found`);
  const pt = quarterHeaders(sheet.rows.get(rowNumbers[headerIdx]), PT_QUARTER);
  const en = quarterHeaders(sheet.rows.get(rowNumbers[headerIdx + 1]), EN_QUARTER);
  for (const h of pt) {
    const e = en.find(x => x.col === h.col);
    if (!e || e.year !== h.year || e.quarter !== h.quarter) throw new WorkbookLayoutError(`${where}: PT header ${h.label} (${h.col}) has no matching EN header`);
  }
  const ordered = [...pt].sort((a, b) => columnIndex(a.col) - columnIndex(b.col));
  for (let i = 1; i < ordered.length; i++) {
    const [p, c] = [ordered[i - 1], ordered[i]];
    if (c.year * 4 + c.quarter <= p.year * 4 + p.quarter) throw new WorkbookLayoutError(`${where}: quarter columns out of order (${p.label} → ${c.label})`);
  }
  const latest = ordered[ordered.length - 1];

  const rows: number[] = [];
  for (let i = headerIdx + 2; i < rowNumbers.length; i++) {
    if (quarterHeaders(sheet.rows.get(rowNumbers[i]), PT_QUARTER).length > 0) break;
    rows.push(rowNumbers[i]);
  }
  return { sheet, title: titlePt, rows, latest };
}

interface RowSpec {
  pt: string;
  en?: string;
  unitPt?: string;
  unitEn?: string;
}

function findRow(block: Block, spec: RowSpec, layout: Layout): number | null {
  let carried: CellValue | undefined;
  const hits: number[] = [];
  for (const n of block.rows) {
    const cells = block.sheet.rows.get(n)!;
    const label = cells.get(layout.labelPt);
    if (label !== undefined) carried = label;
    else if (!layout.carryLabel) continue;
    if (norm(layout.carryLabel ? carried : label) !== normalizeDescription(spec.pt)) continue;
    if (spec.en && !layout.carryLabel && norm(cells.get(layout.labelEn)) !== normalizeDescription(spec.en)) continue;
    if (spec.unitPt && norm(cells.get(layout.unitPt!)) !== normalizeDescription(spec.unitPt)) continue;
    if (spec.unitEn && norm(cells.get(layout.unitEn!)) !== normalizeDescription(spec.unitEn)) continue;
    hits.push(n);
  }
  if (hits.length > 1) throw new WorkbookLayoutError(`${block.sheet.name} / "${block.title}": row "${spec.pt}${spec.unitPt ? ` — ${spec.unitPt}` : ""}" is ambiguous (${hits.length} rows)`);
  return hits[0] ?? null;
}

function numericAt(block: Block, row: number | null): number | null {
  if (row === null) return null;
  const v = block.sheet.rows.get(row)?.get(block.latest.col);
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function describe(block: Block, spec: RowSpec): string {
  return `${block.sheet.name} › ${block.title} › ${spec.pt}${spec.unitPt ? ` › ${spec.unitPt}` : ""} › ${block.latest.label}`;
}

/** CORE value: the row must exist and be numeric. */
function core(block: Block, spec: RowSpec, layout: Layout, unit: string): WorkbookValue {
  const value = numericAt(block, findRow(block, spec, layout));
  if (value === null) throw new WorkbookLayoutError(`${describe(block, spec)}: CORE value missing or not numeric`);
  return { value, unit, source: describe(block, spec) };
}

/** Optional value: null (with an issue) when absent or non-numeric. */
function optional(block: Block | null, spec: RowSpec, layout: Layout, unit: string, issues: string[]): WorkbookValue {
  if (!block) return { value: null, unit, source: "" };
  let row: number | null = null;
  try {
    row = findRow(block, spec, layout);
  } catch (err) {
    issues.push(err instanceof Error ? err.message : String(err));
  }
  const value = numericAt(block, row);
  if (value === null) issues.push(`${describe(block, spec)}: optional value unavailable`);
  return { value, unit, source: value === null ? "" : describe(block, spec) };
}

function tryBlock(sheet: XlsxSheet, titlePt: string, titleEn: string, layout: Layout, issues: string[]): Block | null {
  try {
    return findBlock(sheet, titlePt, titleEn, layout);
  } catch (err) {
    issues.push(err instanceof Error ? err.message : String(err));
    return null;
  }
}

export interface ParsedB3Workbook {
  quarterLabel: string;
  quarterEnd: string;
  derivatives: { adv: WorkbookValue; rpc: WorkbookValue };
  cashEquities: { adtv: WorkbookValue; feeMarginBps: WorkbookValue };
  fixedIncomeCredit: {
    bankingInstrumentsAverageStock: WorkbookValue;
    corporateBondsAverageStock: WorkbookValue;
    otherAverageStock: WorkbookValue;
  };
  secondary: {
    otcDerivativesAverageStock: WorkbookValue;
    securitiesLendingAverageOpenInterest: WorkbookValue;
    tesouroDiretoAverageStock: WorkbookValue;
  };
  incomeStatement: {
    /** BRL (the sheet publishes R$ thousands). */
    totalRevenue: number;
    expenses: number | null;
    expenseLines: ExpenseCompositionLine[] | null;
    operatingResult: number | null;
    operatingMargin: number | null;
    ebitda: number | null;
  };
  notes: string[];
  issues: string[];
}

const QUARTER_END: Record<number, string> = { 1: "03-31", 2: "06-30", 3: "09-30", 4: "12-31" };

function requireSheet(wb: XlsxWorkbook, name: string): XlsxSheet {
  const sheet = wb.sheet(name);
  if (!sheet) throw new WorkbookLayoutError(`sheet "${name}" missing`);
  return sheet;
}

const thousands = (v: number | null) => (v === null ? null : Math.round(v * 1_000));

/** Rows "Pessoal e encargos" … "Diversas" between "Despesas" and "Resultado operacional". */
function expenseLines(block: Block, issues: string[]): ExpenseCompositionLine[] | null {
  const labels = block.rows.map(n => ({ n, pt: norm(block.sheet.rows.get(n)!.get(IS_LAYOUT.labelPt)) }));
  const start = labels.filter(l => l.pt === normalizeDescription("Despesas"));
  const end = labels.filter(l => l.pt === normalizeDescription("Resultado operacional"));
  if (start.length !== 1 || end.length !== 1 || end[0].n <= start[0].n) {
    issues.push(`${block.sheet.name}: expense breakdown rows not identifiable`);
    return null;
  }
  const out: ExpenseCompositionLine[] = [];
  for (const { n } of labels.filter(l => l.n > start[0].n && l.n < end[0].n)) {
    const cells = block.sheet.rows.get(n)!;
    const label = cells.get(IS_LAYOUT.labelPt);
    const value = numericAt(block, n);
    if (typeof label !== "string" || value === null) {
      issues.push(`${block.sheet.name}: expense line at row ${n} unreadable`);
      return null;
    }
    out.push({ label: label.trim(), labelEn: String(cells.get(IS_LAYOUT.labelEn) ?? "").trim(), value: Math.round(value * 1_000) });
  }
  return out;
}

function notesIn(sheet: XlsxSheet): string[] {
  const out: string[] = [];
  for (const cells of sheet.rows.values()) {
    for (const v of cells.values()) {
      if (typeof v === "string" && /^N[úu]meros (marcados )?em amarelo/i.test(v.trim())) {
        out.push(`${sheet.name}: ${v.split("/")[0].trim()}`);
      }
    }
  }
  return out;
}

/** Parses the official workbook. Throws WorkbookLayoutError / XlsxFormatError on a structural problem. */
export function parseB3QuarterlyWorkbook(bytes: Uint8Array): ParsedB3Workbook {
  const wb = new XlsxWorkbook(bytes);
  const issues: string[] = [];

  const is = requireSheet(wb, WORKBOOK_SHEETS.incomeStatement);
  const der = requireSheet(wb, WORKBOOK_SHEETS.derivatives);
  const eq = requireSheet(wb, WORKBOOK_SHEETS.equities);
  const fi = requireSheet(wb, WORKBOOK_SHEETS.fixedIncome);

  const revenueBlock = findBlock(is, "Receitas (R$ milhares)", "Revenues (R$ thousand)", IS_LAYOUT);
  const ebitdaBlock = tryBlock(is, "Ajustes no EBITDA", "Ajustments to EBITDA", IS_LAYOUT, issues);
  const derBlock = findBlock(der, "Derivativos - Volumes & RPC", "Derivatives - Volumes & RPC", KPI_LAYOUT);
  const eqBlock = findBlock(eq, "Renda Variável", "Equities", KPI_LAYOUT);
  const fiBlock = findBlock(fi, "Renda Fixa - Volumes", "Fixed Income - Volumes", KPI_LAYOUT);
  const otcBlock = tryBlock(der, "Derivativos de Balcão - Volumes", "OTC Derivatives - Volumes", KPI_LAYOUT, issues);
  const lendingBlock = tryBlock(eq, "Empréstimo de Ações", "Securities Lending", KPI_LAYOUT, issues);

  const blocks = [revenueBlock, derBlock, eqBlock, fiBlock, ebitdaBlock, otcBlock, lendingBlock].filter((b): b is Block => b !== null);
  const latest = revenueBlock.latest;
  const disagree = blocks.filter(b => b.latest.year !== latest.year || b.latest.quarter !== latest.quarter);
  if (disagree.length > 0) {
    throw new WorkbookLayoutError(`blocks disagree on the latest quarter: ${blocks.map(b => `${b.sheet.name} › ${b.title}=${b.latest.label}`).join(", ")}`);
  }

  const totalRevenue = thousands(numericAt(revenueBlock, findRow(revenueBlock, { pt: "Receita total", en: "Total revenue" }, IS_LAYOUT)));
  if (totalRevenue === null) throw new WorkbookLayoutError(`${WORKBOOK_SHEETS.incomeStatement}: "Receita total" missing for ${latest.label}`);
  const expenses = thousands(numericAt(revenueBlock, findRow(revenueBlock, { pt: "Despesas", en: "Expenses" }, IS_LAYOUT)));
  const operatingResult = thousands(numericAt(revenueBlock, findRow(revenueBlock, { pt: "Resultado operacional", en: "Operating income" }, IS_LAYOUT)));
  const operatingMargin = numericAt(revenueBlock, findRow(revenueBlock, { pt: "Margem operacional", en: "Operating margin" }, IS_LAYOUT));
  const ebitda = ebitdaBlock ? thousands(numericAt(ebitdaBlock, findRow(ebitdaBlock, { pt: "EBITDA", en: "EBITDA" }, IS_LAYOUT))) : null;
  for (const [label, v] of [["Despesas", expenses], ["Resultado operacional", operatingResult], ["Margem operacional", operatingMargin], ["EBITDA", ebitda]] as const) {
    if (v === null) issues.push(`${WORKBOOK_SHEETS.incomeStatement}: "${label}" unavailable for ${latest.label}`);
  }

  const notes = [...notesIn(der), ...notesIn(eq), ...notesIn(fi)];
  if (tryBlock(is, "Efeito do hedge no resultado", "Hedge effects on results", IS_LAYOUT, [])) {
    notes.push(`${WORKBOOK_SHEETS.incomeStatement}: B3 discloses hedge-accounting effects on the financial result and taxes; this model keeps reported values (no adjusted series).`);
  }

  return {
    quarterLabel: latest.label,
    quarterEnd: `${latest.year}-${QUARTER_END[latest.quarter]}`,
    derivatives: {
      adv: core(derBlock, { pt: "Geral", unitPt: "ADV total (milhares de contratos)", unitEn: "Total ADV (thousand of contracts)" }, KPI_LAYOUT, "milhares de contratos/dia (média do trimestre)"),
      rpc: core(derBlock, { pt: "Geral", unitPt: "RPC média (R$)", unitEn: "Average RPC (R$)" }, KPI_LAYOUT, "R$ por contrato (média do trimestre)"),
    },
    cashEquities: {
      adtv: core(eqBlock, { pt: "Ações à vista", unitPt: "ADTV (R$ milhões)", unitEn: "ADTV (R$ million)" }, KPI_LAYOUT, "R$ milhões/dia (média do trimestre)"),
      feeMarginBps: core(eqBlock, { pt: "Ações à vista", unitPt: "Margem (bps)", unitEn: "Margin (bps)" }, KPI_LAYOUT, "bps"),
    },
    fixedIncomeCredit: {
      bankingInstrumentsAverageStock: core(fiBlock, { pt: "Estoque", unitPt: "Captação bancária (média em R$ bilhões)", unitEn: "Banking instruments (average in R$ billion)" }, KPI_LAYOUT, "R$ bilhões (média do trimestre)"),
      corporateBondsAverageStock: core(fiBlock, { pt: "Estoque", unitPt: "Dívida corporativa (média em R$ bilhões)", unitEn: "Corporate bonds (average in R$ billion)" }, KPI_LAYOUT, "R$ bilhões (média do trimestre)"),
      otherAverageStock: core(fiBlock, { pt: "Estoque", unitPt: "Outros (média em R$ bilhões)", unitEn: "Other (average in R$ billion)" }, KPI_LAYOUT, "R$ bilhões (média do trimestre)"),
    },
    secondary: {
      otcDerivativesAverageStock: optional(otcBlock, { pt: "Estoque", unitPt: "média em R$ bilhões", unitEn: "average in R$ billion" }, KPI_LAYOUT, "R$ bilhões (média do trimestre)", issues),
      securitiesLendingAverageOpenInterest: optional(lendingBlock, { pt: "Empréstimo de ativos", unitPt: "Pos. em aberto média (R$ bilhões)", unitEn: "Average open interest (R$ billion)" }, KPI_LAYOUT, "R$ bilhões (média do trimestre)", issues),
      tesouroDiretoAverageStock: optional(fiBlock, { pt: "Tesouro Direto", unitPt: "Estoque (média em R$ bilhões)", unitEn: "Outstanding volume (average in R$ billion)" }, KPI_LAYOUT, "R$ bilhões (média do trimestre)", issues),
    },
    incomeStatement: {
      totalRevenue,
      expenses,
      expenseLines: expenseLines(revenueBlock, issues),
      operatingResult,
      operatingMargin,
      ebitda,
    },
    notes,
    issues,
  };
}
