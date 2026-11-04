// CVM Dados Abertos access for holding statements (precompute time only).
//
// Reuses the DFP/ITR zip downloaders of the CVM clients; reads the `_ind`
// (parent-only) statement files, the filing index and composicao_capital.
// The zip loader is injectable so tests never reach the network.
//
// No @/ imports — also used by tsx scripts.

import { unzipSync } from "fflate";
import { fetchYearZip } from "../cvm/dfp-client";
import { fetchItrYearZip } from "../cvm/itr-client";
import {
  groupRowsByPeriod,
  parseCapitalCsv,
  parseFilingIndexCsv,
  parseHoldingStatementCsv,
  type CvmFilingIndexEntry,
  type HoldingCvmRow,
} from "./holding-cvm-rows";
import { buildHoldingStatement } from "./holding-statements";
import type { CapitalSnapshot } from "./holding-share-classes";
import type { HoldingIdentity } from "./holding-identities";
import type { HoldingStatement } from "./holding-types";

export type CvmDocKind = "DFP" | "ITR";
export type ZipLoader = (kind: CvmDocKind, year: number) => Promise<Uint8Array | null>;

export const defaultZipLoader: ZipLoader = (kind, year) =>
  kind === "DFP" ? fetchYearZip(year) : fetchItrYearZip(year);

const STATEMENT_FILES = ["BPA_ind", "BPP_ind", "DRE_ind", "DFC_MI_ind", "DFC_MD_ind"] as const;

export interface HoldingCvmResult {
  statements: HoldingStatement[];
  capital: CapitalSnapshot[];
  /** Consolidated rows seen and discarded (diagnostic). */
  rejectedConsolidatedRows: number;
  sources: string[];
}

function readEntry(zip: Uint8Array, name: string): string | null {
  const out = unzipSync(zip, { filter: f => f.name === name });
  const bytes = out[name];
  return bytes ? new TextDecoder("latin1").decode(bytes) : null;
}

/**
 * Loads parent-only statements for the requested years. Throws when a
 * required year's zip cannot be downloaded or a file changes layout, so the
 * caller can preserve the previous statement history. `optionalYears` (the
 * current year, whose zip may not exist yet) are skipped when absent.
 */
export async function loadHoldingCvmData(
  identity: HoldingIdentity,
  years: { dfp: readonly number[]; itr: readonly number[]; optional: readonly number[] },
  loadZip: ZipLoader = defaultZipLoader,
): Promise<HoldingCvmResult> {
  const statements: HoldingStatement[] = [];
  const capital: CapitalSnapshot[] = [];
  const sources: string[] = [];
  let rejectedConsolidatedRows = 0;

  const jobs: [CvmDocKind, number][] = [
    ...years.dfp.map(y => ["DFP", y] as [CvmDocKind, number]),
    ...years.itr.map(y => ["ITR", y] as [CvmDocKind, number]),
  ];
  for (const [kind, year] of jobs) {
    const zip = await loadZip(kind, year);
    if (!zip) {
      if (years.optional.includes(year)) continue;
      throw new Error(`CVM ${kind} ${year} zip unavailable`);
    }
    const prefix = `${kind.toLowerCase()}_cia_aberta`;
    const indexText = readEntry(zip, `${prefix}_${year}.csv`);
    if (indexText === null) throw new Error(`CVM ${kind} ${year}: filing index missing`);
    const filings: CvmFilingIndexEntry[] = parseFilingIndexCsv(indexText, identity);

    const rows: HoldingCvmRow[] = [];
    for (const file of STATEMENT_FILES) {
      const text = readEntry(zip, `${prefix}_${file}_${year}.csv`);
      if (text === null) {
        if (file === "DFC_MD_ind") continue;  // issuers file one DFC method
        throw new Error(`CVM ${kind} ${year}: ${file} missing`);
      }
      const parsed = parseHoldingStatementCsv(text, file.replace(/_ind$/, ""), identity);
      rows.push(...parsed.rows);
      rejectedConsolidatedRows += parsed.rejectedConsolidated;
    }
    for (const period of groupRowsByPeriod(rows)) {
      const st = buildHoldingStatement(period, kind, identity, filings);
      if (st) statements.push(st);
    }

    const capitalText = readEntry(zip, `${prefix}_composicao_capital_${year}.csv`);
    if (capitalText !== null) {
      capital.push(...parseCapitalCsv(capitalText, identity.cnpj).map(c => ({ ...c, document: kind })));
    }
    sources.push(`https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/${kind}/DADOS/${prefix}_${year}.zip`);
  }

  statements.sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  return { statements, capital, rejectedConsolidatedRows, sources };
}
