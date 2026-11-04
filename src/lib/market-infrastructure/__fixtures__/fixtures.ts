// Test helpers for the official-source fixtures in this folder.
//
//   cvm-b3-*.json — rows of CD_CVM 21610 (B3 S.A.) cut from the CVM Dados
//                   Abertos zips (URL and trimming in each file), downloaded
//                   2026-11-04: DFP 2024–2025, ITR 2024 (2024-06-30 only),
//                   ITR 2025–2026. Consolidated statements, accounts the model
//                   reads; comparatives kept for DFP 2025 (restated FY2024)
//                   and ITR 2026 (restated 2025 periods).
//   cvm-b3-dre-ind-2026-06-30.csv — verbatim DF Individual rows (parent-only).
//   b3-dados-trimestrais-2T26.xlsx — the official workbook "Dados Trimestrais -
//                   Nova Segmentação - 2T26" (MZ document 0e3b9b70-…, published
//                   2026-08-11, original sha256 d6454eef…9704, 2,342,622 bytes),
//                   trimmed to the four sheets the parser reads (IS (New Seg),
//                   Derivatives, Equities & Sec. Lend., Fixed Income & Credit):
//                   sheet XML, shared strings, styles and theme verbatim;
//                   external links, defined names, calcChain and the other
//                   eleven sheets removed.
//   b3-ri-listing-2026.json — verbatim B3 RI (MZiQ) listing response.

import { readFileSync } from "fs";
import { join } from "path";
import { zipSync } from "fflate";
import type { CvmDocKind, ZipLoader } from "../market-infrastructure-cvm-client";
import { loadMarketInfrastructureCvmData } from "../market-infrastructure-cvm-client";
import { B3SA3_IDENTITY } from "../market-infrastructure-identity";
import { parseB3QuarterlyWorkbook } from "../b3-workbook";
import type { WorkbookSource } from "../market-infrastructure-types";

const DIR = __dirname;

export const fixtureText = (name: string) => readFileSync(join(DIR, name), "utf-8");
export const fixtureBytes = (name: string) => new Uint8Array(readFileSync(join(DIR, name)));

export const WORKBOOK_FIXTURE = "b3-dados-trimestrais-2T26.xlsx";

export function cvmFixtureFiles(kind: CvmDocKind, year: number): Record<string, string> {
  return (JSON.parse(fixtureText(`cvm-b3-${kind.toLowerCase()}-${year}.json`)) as { files: Record<string, string> }).files;
}

/** CVM CSVs are Latin-1 inside the official zips. */
export function latin1(s: string): Uint8Array {
  return Uint8Array.from(s, ch => ch.charCodeAt(0));
}

export const FIXTURE_YEARS: [CvmDocKind, number][] = [["DFP", 2024], ["DFP", 2025], ["ITR", 2024], ["ITR", 2025], ["ITR", 2026]];

/** A zip loader serving the recorded CVM fixtures; other years are "unavailable". */
export function fixtureZipLoader(
  available: [CvmDocKind, number][] = FIXTURE_YEARS,
  edit?: (name: string, csv: string) => string,
): ZipLoader {
  return async (kind, year) => {
    if (!available.some(([k, y]) => k === kind && y === year)) return null;
    const files = cvmFixtureFiles(kind, year);
    return zipSync(Object.fromEntries(Object.entries(files).map(([n, t]) => [n, latin1(edit ? edit(n, t) : t)])));
  };
}

export const FIXTURE_LOAD_YEARS = { dfp: [2024, 2025], itr: [2024, 2025, 2026], optional: [] };

export function loadFixtureCvm(edit?: (name: string, csv: string) => string, available?: [CvmDocKind, number][]) {
  return loadMarketInfrastructureCvmData(B3SA3_IDENTITY, FIXTURE_LOAD_YEARS, fixtureZipLoader(available, edit));
}

export const WORKBOOK_SOURCE: WorkbookSource = {
  title: "Dados Trimestrais - Nova Segmentação",
  fileName: "Dados Trimestrais - Nova Segmentação - 2T26",
  url: "https://api.mziq.com/mzfilemanager/v2/d/5fd7b7d8-54a1-472d-8426-eb896ad8a3c4/ffcde376-8e29-82fa-d2d3-67db4efcec79?origin=2",
  mzDocumentId: "0e3b9b70-2505-4fa8-99d7-052c32ab8729",
  publishedDate: "2026-08-11",
  fileQuarter: 2,
  fileYear: 2026,
  sha256: "d6454eef452dd65d9d4444f3b546936fb15cc9192edf54fc8c5b15146eb39704",
  byteLength: 2_342_622,
};

export function parsedWorkbookFixture() {
  return parseB3QuarterlyWorkbook(fixtureBytes(WORKBOOK_FIXTURE));
}
