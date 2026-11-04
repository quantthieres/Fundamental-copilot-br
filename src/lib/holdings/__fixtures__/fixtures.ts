// Test helpers for the official-source fixtures in this folder.
//
//   cvm-*.json        — rows of CD_CVM 7617 / 18724 cut from the CVM Dados
//                       Abertos zips (URL in each file), downloaded 2026-11-03.
//   itausa-portfolio-2026-10-15.html — verbatim excerpt of the Itaúsa page.
//   bradespar-bq-2026-11-03.pdf      — the official bulletin "BQ - 03/11/2026"
//                       (AEM path …/boletim-quinzenal/2026/BQ_2026_03.11.2026_PORT-1.pdf).
//   bradespar-bq-2026-11-03.txt      — its embedded text as extracted by unpdf.
//   bradespar-bq-listing.json        — AEM listing items (trimmed).

import { readFileSync } from "fs";
import { join } from "path";
import { zipSync } from "fflate";
import type { CvmDocKind, ZipLoader } from "../holding-cvm-client";

const DIR = __dirname;

export const fixtureText = (name: string) => readFileSync(join(DIR, name), "utf-8");
export const fixtureBytes = (name: string) => new Uint8Array(readFileSync(join(DIR, name)));

export function cvmFixtureFiles(kind: CvmDocKind, year: number): Record<string, string> {
  return (JSON.parse(fixtureText(`cvm-${kind.toLowerCase()}-${year}.json`)) as { files: Record<string, string> }).files;
}

/** CVM CSVs are Latin-1 inside the official zips. */
function latin1(s: string): Uint8Array {
  return Uint8Array.from(s, ch => ch.charCodeAt(0));
}

/** A zip loader serving the recorded CVM fixtures; other years are "unavailable". */
export function fixtureZipLoader(available: [CvmDocKind, number][] = [["DFP", 2025], ["ITR", 2025], ["ITR", 2026]]): ZipLoader {
  return async (kind, year) => {
    if (!available.some(([k, y]) => k === kind && y === year)) return null;
    const files = cvmFixtureFiles(kind, year);
    return zipSync(Object.fromEntries(Object.entries(files).map(([n, t]) => [n, latin1(t)])));
  };
}
