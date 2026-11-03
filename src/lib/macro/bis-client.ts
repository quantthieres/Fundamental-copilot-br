// BIS central bank policy rates client (BIS SDMX REST API v2).
//
// Verified 2026-11-02:
//   Dataflow   BIS:WS_CBPOL(1.0) — "Central bank policy rates", DSD BIS_CBPOL(1.0)
//   Dimensions FREQ (CL_FREQ: D daily, M monthly, …), REF_AREA
//              (CL_BIS_GL_REF_AREA: ISO 3166-1 alpha-2 plus BIS aggregates,
//              e.g. XM = euro area), TIME_PERIOD ("YYYY-MM" for monthly)
//   Monthly    end-of-period value ("Monthly - End of period" series title)
//   Attributes UNIT_MEASURE 368 = "Per cent per year", UNIT_MULT 0 = units,
//              OBS_STATUS (A normal, M missing with OBS_VALUE "NaN", …)
//   Format     SDMX-CSV 2.0 via Accept header. Auth: none.
//
// No @/ imports — also used by tsx scripts.

import { fetchTextWithRetry } from "./macro-http";

export const BIS_SDMX_BASE = "https://stats.bis.org/api/v2";
export const BIS_CBPOL_DATAFLOW = "BIS:WS_CBPOL(1.0)";
export const BIS_UNIT_PERCENT_PER_YEAR = "368";
export const BIS_CSV_ACCEPT = "application/vnd.sdmx.data+csv;version=2.0.0";

export function buildBisPolicyRateUrl(startYear: number): string {
  if (!Number.isInteger(startYear)) throw new Error("buildBisPolicyRateUrl: invalid start year");
  // Key: FREQ=M . REF_AREA=* (all areas)
  return `${BIS_SDMX_BASE}/data/dataflow/BIS/WS_CBPOL/1.0/M.*?startPeriod=${startYear}-01`;
}

/** RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF/LF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += ch;
    }
  }
  if (inQuotes) throw new Error("Malformed CSV: unterminated quoted field");
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0] === ""));
}

export interface BisRawObservation {
  freq: string;
  refArea: string;
  period: string;
  value: string;
  obsStatus: string;
  unitMeasure: string;
  unitMult: string;
}

const REQUIRED_COLUMNS = ["FREQ", "REF_AREA", "TIME_PERIOD", "OBS_VALUE", "UNIT_MEASURE", "UNIT_MULT", "OBS_STATUS"] as const;

/** Parses a WS_CBPOL SDMX-CSV response. Throws when required columns are missing. */
export function parseBisPolicyRateCsv(text: string): BisRawObservation[] {
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error("Empty BIS response");
  const header = rows[0];
  const idx: Record<string, number> = {};
  for (const col of REQUIRED_COLUMNS) {
    const i = header.indexOf(col);
    if (i < 0) throw new Error(`Unexpected BIS CSV: missing column ${col}`);
    idx[col] = i;
  }
  const structureIdx = header.indexOf("STRUCTURE_ID");
  const out: BisRawObservation[] = [];
  for (const r of rows.slice(1)) {
    if (structureIdx >= 0 && r[structureIdx] && r[structureIdx] !== BIS_CBPOL_DATAFLOW) {
      throw new Error(`Unexpected BIS dataflow ${r[structureIdx]}`);
    }
    out.push({
      freq: r[idx.FREQ] ?? "",
      refArea: r[idx.REF_AREA] ?? "",
      period: r[idx.TIME_PERIOD] ?? "",
      value: r[idx.OBS_VALUE] ?? "",
      obsStatus: r[idx.OBS_STATUS] ?? "",
      unitMeasure: r[idx.UNIT_MEASURE] ?? "",
      unitMult: r[idx.UNIT_MULT] ?? "",
    });
  }
  return out;
}

export async function fetchBisPolicyRates(startYear: number): Promise<BisRawObservation[]> {
  const csv = await fetchTextWithRetry(buildBisPolicyRateUrl(startYear), { accept: BIS_CSV_ACCEPT });
  return parseBisPolicyRateCsv(csv);
}
