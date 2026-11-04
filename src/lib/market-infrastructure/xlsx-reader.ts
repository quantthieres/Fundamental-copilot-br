// Minimal XLSX (Office Open XML) cell reader on top of fflate — enough to
// read cached cell values of an official workbook without an Excel
// dependency. Reads xl/workbook.xml (sheet names), its relationships (sheet
// paths), xl/sharedStrings.xml and the worksheet cells. Formulas are not
// evaluated: the cached <v> value Excel saved is used. Styles, external links
// and every other part are ignored.
//
// Precompute/test-side only. No @/ imports — also used by tsx scripts.

import { strFromU8, unzipSync } from "fflate";

export type CellValue = string | number;

export interface XlsxSheet {
  name: string;
  /** row number → column letters → value (empty cells absent). */
  rows: Map<number, Map<string, CellValue>>;
}

export class XlsxFormatError extends Error {}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, e: string) =>
    e.startsWith("#x") ? String.fromCodePoint(parseInt(e.slice(2), 16))
      : e.startsWith("#") ? String.fromCodePoint(Number(e.slice(1)))
        : ENTITIES[e]);
}

function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:]+)="([^"]*)"/g)) out[m[1]] = decodeXml(m[2]);
  return out;
}

/** Concatenated text of every <t> element (rich-text runs included). */
function textOf(xml: string): string {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m => decodeXml(m[1])).join("");
}

export class XlsxWorkbook {
  private readonly files: Record<string, Uint8Array>;
  readonly sheetNames: string[];
  private readonly sheetPaths = new Map<string, string>();
  private readonly sharedStrings: string[];
  private readonly cache = new Map<string, XlsxSheet>();

  constructor(bytes: Uint8Array) {
    if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new XlsxFormatError("not a zip/XLSX file");
    try {
      this.files = unzipSync(bytes, { filter: f => f.name.startsWith("xl/") && !f.name.startsWith("xl/externalLinks/") && !f.name.startsWith("xl/printerSettings/") });
    } catch (err) {
      throw new XlsxFormatError(`unreadable XLSX: ${err instanceof Error ? err.message : String(err)}`);
    }
    const workbook = this.text("xl/workbook.xml");
    const rels = this.text("xl/_rels/workbook.xml.rels");
    if (workbook === null || rels === null) throw new XlsxFormatError("xl/workbook.xml or its relationships missing");

    const targets = new Map<string, string>();
    for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
      const a = attributes(m[0]);
      if (a.Id && a.Target) targets.set(a.Id, a.Target.startsWith("/") ? a.Target.slice(1) : `xl/${a.Target}`);
    }
    this.sheetNames = [];
    for (const m of workbook.matchAll(/<sheet\b[^>]*>/g)) {
      const a = attributes(m[0]);
      const target = targets.get(a["r:id"] ?? "");
      if (!a.name || !target) continue;
      this.sheetNames.push(a.name);
      this.sheetPaths.set(a.name, target);
    }
    const shared = this.text("xl/sharedStrings.xml");
    this.sharedStrings = shared === null ? [] : [...shared.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => textOf(m[1]));
  }

  private text(path: string): string | null {
    const bytes = this.files[path];
    return bytes ? strFromU8(bytes) : null;
  }

  /** The sheet with exactly this name, or null. */
  sheet(name: string): XlsxSheet | null {
    const cached = this.cache.get(name);
    if (cached) return cached;
    const path = this.sheetPaths.get(name);
    const xml = path ? this.text(path) : null;
    if (xml === null) return null;

    const rows = new Map<number, Map<string, CellValue>>();
    for (const rm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const rowNumber = Number(attributes(rm[1]).r);
      if (!Number.isInteger(rowNumber)) throw new XlsxFormatError(`${name}: row without a number`);
      const cells = new Map<string, CellValue>();
      for (const cm of (rm[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const a = attributes(cm[1]);
        const col = /^([A-Z]+)\d+$/.exec(a.r ?? "")?.[1];
        const body = cm[2] ?? "";
        if (!col || !body) continue;
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        let value: CellValue | null = null;
        switch (a.t) {
          case "s": value = v === undefined ? null : this.sharedStrings[Number(v)] ?? null; break;
          case "str": value = v === undefined ? null : decodeXml(v); break;
          case "inlineStr": value = textOf(body); break;
          case "b": case "e": value = null; break;
          default: {
            if (v === undefined) break;
            const n = Number(v);
            value = Number.isFinite(n) ? n : null;
          }
        }
        if (value !== null && value !== "") cells.set(col, value);
      }
      if (cells.size > 0) rows.set(rowNumber, cells);
    }
    const sheet = { name, rows };
    this.cache.set(name, sheet);
    return sheet;
  }
}

/** Column letters → 1-based index (A = 1, AA = 27). */
export function columnIndex(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}
