// CVM Dados Abertos access for the market-infrastructure model (precompute
// time only).
//
// Reuses the DFP/ITR zip downloaders of the CVM clients; reads the `_con`
// (consolidated) statement files, the filing index and composicao_capital.
// The zip loader is injectable so tests never reach the network.
//
// No @/ imports — also used by tsx scripts.

import { unzipSync } from "fflate";
import { fetchYearZip } from "../cvm/dfp-client";
import { fetchItrYearZip } from "../cvm/itr-client";
import {
  groupRowsByFiling,
  parseConsolidatedStatementCsv,
  parseFilingIndexCsv,
  parseShareCountCsv,
  type CvmRow,
  type RawFiling,
} from "./market-infrastructure-cvm-rows";
import { buildStatement } from "./market-infrastructure-statements";
import type { MarketInfrastructureIdentity } from "./market-infrastructure-identity";
import type { MarketInfrastructureStatement, ShareCountSnapshot } from "./market-infrastructure-types";

export type CvmDocKind = "DFP" | "ITR";
export type ZipLoader = (kind: CvmDocKind, year: number) => Promise<Uint8Array | null>;

export const defaultZipLoader: ZipLoader = (kind, year) =>
  kind === "DFP" ? fetchYearZip(year) : fetchItrYearZip(year);

const STATEMENT_FILES = ["BPA_con", "BPP_con", "DRE_con", "DFC_MI_con"] as const;

export interface MarketInfrastructureCvmResult {
  statements: MarketInfrastructureStatement[];
  /** Raw filings (current + comparative rows) for the segment parser. */
  filings: RawFiling[];
  shareCounts: ShareCountSnapshot[];
  rejectedParentOnlyRows: number;
  sources: string[];
}

function readEntry(zip: Uint8Array, name: string): string | null {
  const out = unzipSync(zip, { filter: f => f.name === name });
  const bytes = out[name];
  return bytes ? new TextDecoder("latin1").decode(bytes) : null;
}

/**
 * Loads consolidated statements for the requested years. Throws when a
 * required year's zip cannot be downloaded or a file changes layout, so the
 * caller can preserve the previous statement history. `optional` years (the
 * current year's DFP/ITR may not exist yet) are skipped when absent.
 */
export async function loadMarketInfrastructureCvmData(
  identity: MarketInfrastructureIdentity,
  years: { dfp: readonly number[]; itr: readonly number[]; optional: readonly { kind: CvmDocKind; year: number }[] },
  loadZip: ZipLoader = defaultZipLoader,
): Promise<MarketInfrastructureCvmResult> {
  const statements: MarketInfrastructureStatement[] = [];
  const filings: RawFiling[] = [];
  const shareCounts: ShareCountSnapshot[] = [];
  const sources: string[] = [];
  let rejectedParentOnlyRows = 0;

  const jobs: [CvmDocKind, number][] = [
    ...years.dfp.map(y => ["DFP", y] as [CvmDocKind, number]),
    ...years.itr.map(y => ["ITR", y] as [CvmDocKind, number]),
  ];
  for (const [kind, year] of jobs) {
    const zip = await loadZip(kind, year);
    if (!zip) {
      if (years.optional.some(o => o.kind === kind && o.year === year)) continue;
      throw new Error(`CVM ${kind} ${year} zip unavailable`);
    }
    const prefix = `${kind.toLowerCase()}_cia_aberta`;
    const indexText = readEntry(zip, `${prefix}_${year}.csv`);
    if (indexText === null) throw new Error(`CVM ${kind} ${year}: filing index missing`);
    const index = parseFilingIndexCsv(indexText, identity);

    const rows: CvmRow[] = [];
    for (const file of STATEMENT_FILES) {
      const text = readEntry(zip, `${prefix}_${file}_${year}.csv`);
      if (text === null) throw new Error(`CVM ${kind} ${year}: ${file} missing`);
      const parsed = parseConsolidatedStatementCsv(text, file.replace(/_con$/, ""), identity);
      rows.push(...parsed.rows);
      rejectedParentOnlyRows += parsed.rejectedParentOnly;
    }
    for (const filing of groupRowsByFiling(rows, kind)) {
      filings.push(filing);
      const st = buildStatement(filing, index);
      if (st) statements.push(st);
    }

    const capitalText = readEntry(zip, `${prefix}_composicao_capital_${year}.csv`);
    if (capitalText !== null) shareCounts.push(...parseShareCountCsv(capitalText, identity.cnpj, kind));
    sources.push(`https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/${kind}/DADOS/${prefix}_${year}.zip`);
  }

  statements.sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
  return { statements, filings, shareCounts, rejectedParentOnlyRows, sources };
}
