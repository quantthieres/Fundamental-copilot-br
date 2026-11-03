// Ticker lifecycle: is the trading code itself still current?
//
// This is deliberately separate from `coverageStatus` (what the app can
// analyse) — a ticker can be historical while its issuer is fully covered
// under a successor code.
//
// Every entry below was verified on 2026-11-03 against:
//   [CVM-REG] CVM cad_cia_aberta.csv (registry: SIT, DT_CANCEL, MOTIVO_CANCEL)
//   [CVM-FCA] CVM FCA valor_mobiliario 2020–2026 (Codigo_Negociacao by CNPJ,
//             Data_Inicio/Fim_Negociacao)
//   [B3]      B3 listed-companies service (GetDetail: current trading codes
//             per issuer; GetCompaniesBDR for BDRs)
//   [B3-OC]   B3 official index-treatment notices (Ofícios Circulares)
//   [CVM-FI]  CVM registro_classe.csv (fund classes)
//   [B3-NEWS] B3 news/auction notices (Bora Investir, Plantão de Notícias,
//             editais de leilão) — cited with title and date
// Issuer IR/press is cited only where CVM/B3 data does not state the link.
// Tickers without an entry are "active" (verified as current B3 codes in the
// same pass — see docs/asset-readiness-audit.md).
//
// No @/ imports — also used by tsx scripts.

export type TickerLifecycleStatus =
  | "active"
  | "renamed"        // same issuer, new trading code
  | "converted"      // same issuer, share class converted into another class
  | "incorporated"   // issuer absorbed by another company (new issuer/ticker)
  | "reorganized"    // vehicle wound up after its portfolio moved to another, pre-existing vehicle (different CNPJ)
  | "delisted"       // no longer traded on B3 (tender offer / category change)
  | "cancelled";     // CVM registration cancelled, no successor on B3

/** How the successor relates to the old ticker's issuer. */
export type SuccessorRelation = "same_issuer" | "new_issuer";

export type LifecycleVerification = "verified" | "needs_manual_verification";

export interface TickerLifecycle {
  ticker: string;
  status: Exclude<TickerLifecycleStatus, "active">;
  successorTicker?: string;
  successorRelation?: SuccessorRelation;
  /** ISO date when known from an authoritative source; omitted otherwise. */
  effectiveDate?: string;
  verification: LifecycleVerification;
  evidence: string;
  /** Intermediate codes between this ticker and the successor (e.g. ELET6 → AXIA6 → AXIA3). */
  intermediateTickers?: string[];
  /** Exchange/conversion ratio when the event converted shares, e.g. "1.1 AXIA3 per AXIA6". */
  conversionRatio?: string;
  note?: string;
}

const L = (e: TickerLifecycle): TickerLifecycle => e;

export const TICKER_LIFECYCLE: Readonly<Record<string, TickerLifecycle>> = Object.fromEntries([
  // ── Same issuer, new code ──────────────────────────────────────────────────
  L({ ticker: "RRRP3", status: "renamed", successorTicker: "BRAV3", successorRelation: "same_issuer",
      verification: "verified",
      evidence: "CVM-FCA: RRRP3 (2023) and BRAV3 (2024–2026) under CNPJ 12.091.809/0001-55, CD_CVM 25291; B3: BRAV3 only code" }),
  L({ ticker: "ELET3", status: "renamed", successorTicker: "AXIA3", successorRelation: "same_issuer",
      verification: "verified",
      evidence: "CVM-FCA: ELET3 (2025) → AXIA3 (2026) under CNPJ 00.001.180/0001-26, CD_CVM 2437 (AXIA Energia S.A., ex-Eletrobras); B3: AXIA3, AXIA7; B3-NEWS (Bora Investir, Nov/2025): ELET3/ELET5/ELET6 replaced by AXIA3/AXIA5/AXIA6",
      note: "Rename took effect in Nov/2025 (exact first session not stated in the cited sources)" }),
  L({ ticker: "ELET6", status: "converted", successorTicker: "AXIA3", successorRelation: "same_issuer",
      intermediateTickers: ["AXIA6"], conversionRatio: "1.1 AXIA3 per AXIA6", effectiveDate: "2026-06-08",
      verification: "verified",
      evidence: "B3-NEWS (Bora Investir, Nov/2025): ELET6 renamed AXIA6; B3-OC 035/2026-VNC: PNA1 (AXIA5) and PNB1 (AXIA6) converted into ON (AXIA3) at 1.1 ON per PN, AXIA5/AXIA6 not traded from 2026-06-08; B3: current codes AXIA3, AXIA7",
      note: "AXIA7 (PNC) is a separate class created in Dec/2025, not ELET6's successor — excluded from the curated universe (see CURATION_EXCLUSIONS)" }),
  L({ ticker: "ARZZ3", status: "renamed", successorTicker: "AZZA3", successorRelation: "same_issuer",
      effectiveDate: "2024-08-01", verification: "verified",
      evidence: "CVM-FCA: ARZZ3 (2023) → AZZA3 (2024–2026), CNPJ 16.590.234/0001-76, CD_CVM 22349 (Azzas 2154 S.A.); B3-OC 012/2024-VNC" }),
  L({ ticker: "VVAR3", status: "renamed", successorTicker: "BHIA3", successorRelation: "same_issuer",
      verification: "verified",
      evidence: "CVM-FCA: VVAR3 (2020) → VIIA3 (2021–2022) → BHIA3 (2023–2026), all CNPJ 33.041.260/0652-90, CD_CVM 6505; B3: BHIA3" }),
  L({ ticker: "EMBR3", status: "renamed", successorTicker: "EMBJ3", successorRelation: "same_issuer",
      effectiveDate: "2025-11-03", verification: "verified",
      evidence: "CVM-FCA: EMBR3 (2021–2024), CNPJ 07.689.002/0001-89, CD_CVM 20087; B3: issuer EMBJ, only code EMBJ3; B3-NEWS (Plantão de Notícias, 'AJUSTES NOS INDICES DA B3 EM FUNCAO DE PROVENTOS 03/11/2025'): changes valid for the 2025-11-03 opening — EMBJ3 included, EMBR3 excluded" }),
  L({ ticker: "TRPL4", status: "renamed", successorTicker: "ISAE4", successorRelation: "same_issuer",
      effectiveDate: "2024-11-18", verification: "verified",
      evidence: "CVM-FCA: TRPL4 (2021–2023), CNPJ 02.998.611/0001-04, CD_CVM 18376; B3: ISAE3, ISAE4 (PN → ISAE4); B3-NEWS (Toque de campainha, 2024-11-18): ISA CTEEP renamed ISA Energia Brasil, trading as ISAE4/ISAE3 from that day" }),
  L({ ticker: "ODPV3", status: "renamed", successorTicker: "SAUD3", successorRelation: "same_issuer",
      effectiveDate: "2026-05-05", verification: "verified",
      evidence: "CVM-FCA: ODPV3 (2021–2025), CNPJ 58.119.199/0001-51, CD_CVM 20125; B3: issuer SAUD (Bradsaúde S.A.), only code SAUD3; trading as SAUD3 from the 2026-05-05 session (company notice; B3-NEWS Bora Investir on the Bradsaúde combination)",
      note: "Odontoprev incorporated Bradesco Saúde shares (2026-04-30) before the rename — fundamentals change materially from 2026" }),
  L({ ticker: "MRFG3", status: "renamed", successorTicker: "MBRF3", successorRelation: "same_issuer",
      effectiveDate: "2025-09-23", verification: "verified",
      evidence: "CVM-REG: Marfrig Global Foods CD_CVM 20788 ATIVO; B3: issuer MBRF, only code MBRF3; B3-OC 035/2025-VNC (BRF share incorporation)" }),
  L({ ticker: "CPLE6", status: "converted", successorTicker: "CPLE3", successorRelation: "same_issuer",
      effectiveDate: "2025-11-10", verification: "verified",
      evidence: "CVM-FCA 2026: CPLE6 Data_Fim_Negociacao 2025-11-10, CD_CVM 14311; B3: only equity code CPLE3 (Novo Mercado)" }),
  L({ ticker: "AZUL4", status: "converted", successorTicker: "AZUL3", successorRelation: "same_issuer",
      verification: "verified",
      evidence: "CVM-FCA: AZUL4 (2023–2025) → AZUL3 only (2026), CNPJ 09.305.994/0001-29, CD_CVM 24112; B3: only equity code AZUL3",
      note: "All PN converted into ON in Jan/2026 (Chapter 11 plan, 75 ON per PN per company notices); transitional codes AZUL53/AZUL54 are not current B3 codes" }),

  // ── Issuer absorbed by another company ─────────────────────────────────────
  L({ ticker: "SOMA3", status: "incorporated", successorTicker: "AZZA3", successorRelation: "new_issuer",
      effectiveDate: "2024-07-31", verification: "verified",
      evidence: "CVM-REG: CD_CVM 25011 CANCELADA 2024-07-31 (elisão por incorporação); B3-OC 012/2024-VNC: Grupo Soma incorporated by Arezzo&Co (now Azzas 2154, AZZA3)" }),
  L({ ticker: "PETZ3", status: "incorporated", successorTicker: "AUAU3", successorRelation: "new_issuer",
      effectiveDate: "2026-01-02", verification: "verified",
      evidence: "CVM-FCA 2026: PETZ3 Data_Fim_Negociacao 2026-01-02; AUAU3 (União Pet Participações, CNPJ 53.153.938/0001-08, CD_CVM 27766) from 2026-01-05; CVM-REG: CD_CVM 25089 CANCELADA 2026-05-14",
      note: "Petz–Cobasi combination; 1 AUAU3 per PETZ3 plus cash (company notices)" }),
  L({ ticker: "BRFS3", status: "incorporated", successorTicker: "MBRF3", successorRelation: "new_issuer",
      effectiveDate: "2025-09-22", verification: "verified",
      evidence: "CVM-FCA 2025/2026: BRFS3 Data_Fim_Negociacao 2025-09-22; CVM-REG: BRF S.A. now Categoria B; B3: no trading codes; B3-OC 035/2025-VNC (incorporation of BRF shares by Marfrig → MBRF3)" }),
  L({ ticker: "NTCO3", status: "incorporated", successorTicker: "NATU3", successorRelation: "new_issuer",
      effectiveDate: "2025-07-01", conversionRatio: "1 NATU3 per NTCO3", verification: "verified",
      evidence: "CVM-REG: Natura &Co Holding CD_CVM 24783 CANCELADA (elisão por incorporação), cancellation retroactive to 2025-07-01; B3: Natura Cosméticos S.A. (CD_CVM 19550) trades NATU3",
      note: "Issuer transition (holding incorporated by its subsidiary), NOT a same-issuer rename. The NATU3 fundamentals alias to the NTCO3 cache is valid only because that cache is already sourced from CD_CVM 19550 (see fundamentals-alias.ts)" }),
  L({ ticker: "SULA11", status: "incorporated", successorTicker: "RDOR3", successorRelation: "new_issuer",
      verification: "verified",
      evidence: "B3-OC 189/2022-PRE: SULA11 removed from indices after 2022-12-23, holders receive RDOR3; not in CVM-FCA 2023+",
      note: "CVM-REG shows Sul América S/A CD_CVM 21121 CANCELADA 2022-04-14 (incorporação) — earlier than the last trading day; registry entity vs listed unit mismatch left as-is" }),
  L({ ticker: "CESP6", status: "incorporated", successorTicker: "AURE3", successorRelation: "new_issuer",
      effectiveDate: "2022-03-28", verification: "verified",
      evidence: "B3 (listed-company page, CD_CVM 26620): AURE3 trading started 2022-03-28; B3 auction notice (2022-04-07) on residual fractions from the incorporation of CESP shares by Auren Energia (EGM 2022-03-25); CVM-FCA: CESP3/5/6 absent from 2023 on",
      note: "CESP (CD_CVM 2577) remains a CVM registrant without listed shares" }),
  L({ ticker: "JBSS3", status: "converted", successorTicker: "JBSS32", successorRelation: "new_issuer",
      verification: "verified",
      evidence: "B3: JBS N.V. (CD_CVM 80233, issuer code JBSS) listed 2025-05-30 as BDR JBSS32; JBS S.A. (CD_CVM 20575) has no B3 trading codes",
      note: "Redomiciliation: JBSS3 replaced by BDRs of JBS N.V. from 2025-06-09 (company notices)" }),
  L({ ticker: "BCFF11", status: "incorporated", successorTicker: "BTHF11", successorRelation: "new_issuer",
      verification: "verified",
      evidence: "B3 auction notice 'Edital – Incorporação – BTHF11' (auction 2025-01-09): residual fractions from the incorporation of BCFF11 into BTG Pactual Real Estate Hedge Fund FII (BTHF11), material fact 2024-12-11; CVM-FI: BTHF11 fund class em funcionamento normal",
      note: "fii-cache/BCFF11.json is an available:false placeholder — never counted as coverage" }),
  L({ ticker: "IRDM11", status: "reorganized", successorTicker: "IRIM11", successorRelation: "new_issuer",
      effectiveDate: "2025-11-28", verification: "verified",
      evidence: "CVM-FI registro_fundo: FII Iridium Recebíveis Imobiliários (CNPJ 28.830.325/0001-10) Cancelado 2025-11-28; Iridium FII RL (CNPJ 41.076.564/0001-95, ISIN BRIRIMCTF003) Em Funcionamento Normal; CVM informe mensal: IRDM11 (ISIN BRIRDMCTF004) last filed 2025-10, IRIM11 quotas 1,920,000 → 35,225,778 in 2025-11",
      note: "Portfolio transferred into a different, pre-existing fund; not a rename and not an alias — fii-cache/IRDM11.json stays as historical data" }),

  // ── No successor on B3 ─────────────────────────────────────────────────────
  L({ ticker: "ENBR3", status: "delisted", effectiveDate: "2023-07-11", verification: "verified",
      evidence: "B3-OC 100/2023-PRE: cancellation of EDP Energias do Brasil's listing after the delisting tender offer, ENBR3 not traded from the 2023-07-11 session; CVM-FCA: ENBR3 absent from 2023 on; CVM-REG: CD_CVM 19763 registered without listed securities",
      note: "No current listed successor" }),
  L({ ticker: "STBP3", status: "delisted", effectiveDate: "2025-10-03", verification: "verified",
      evidence: "CVM-REG: Santos Brasil CD_CVM 17892 now Categoria B; B3: market 'balcão não organizado', no trading codes; B3-OC 034/2025-VNC (CMA CGM tender offer)" }),
  L({ ticker: "GOLL4", status: "cancelled", effectiveDate: "2026-04-01", verification: "verified",
      evidence: "CVM-REG: CD_CVM 19569 CANCELADA 2026-04-01 (elisão por incorporação); CVM-FCA 2025: last listed PN code GOLL54",
      note: "Taken private by Abra (tender offer + incorporation into GLA, an unlisted company) — no B3 successor" }),
  L({ ticker: "CRFB3", status: "cancelled", effectiveDate: "2025-12-22", verification: "verified",
      evidence: "CVM-REG: Atacadão CD_CVM 24171 CANCELADA 2025-12-22 (cancelamento voluntário)" }),
  L({ ticker: "BRPR3", status: "cancelled", effectiveDate: "2023-12-20", verification: "verified",
      evidence: "CVM-REG: BR Properties CD_CVM 19925 CANCELADA 2023-12-20 (cancelamento voluntário)" }),

].map(e => [e.ticker, e]));

export function getTickerLifecycle(ticker: string): TickerLifecycle | null {
  return TICKER_LIFECYCLE[ticker.toUpperCase()] ?? null;
}

export function getLifecycleStatus(ticker: string): TickerLifecycleStatus {
  return getTickerLifecycle(ticker)?.status ?? "active";
}

export function isActiveTicker(ticker: string): boolean {
  return getLifecycleStatus(ticker) === "active";
}

export const LIFECYCLE_STATUS_LABEL_PT: Readonly<Record<TickerLifecycleStatus, string>> = {
  active: "Ativo",
  renamed: "Código alterado",
  converted: "Classe convertida",
  incorporated: "Incorporada",
  reorganized: "Reorganizado (carteira transferida)",
  delisted: "Saiu da bolsa",
  cancelled: "Registro cancelado",
};

/** Short Portuguese hint for search/UI, e.g. "Código histórico · Atual: BRAV3". */
export function lifecycleHintPt(ticker: string): string | null {
  const lc = getTickerLifecycle(ticker);
  if (!lc) return null;
  return lc.successorTicker
    ? `Código histórico · Atual: ${lc.successorTicker}`
    : `Código histórico · ${LIFECYCLE_STATUS_LABEL_PT[lc.status]}`;
}

// ─── Curation exclusions ─────────────────────────────────────────────────────
//
// The universe is curated, not exhaustive: it tracks the classes the product
// analyses, not every code an issuer lists. Current B3 codes deliberately left
// out are recorded here so readiness reports never claim absolute completeness.

export interface CurationExclusion {
  ticker: string;
  /** Universe ticker of the same issuer. */
  issuerTicker: string;
  reason: string;
  evidence: string;
}

export const CURATION_EXCLUSIONS: readonly CurationExclusion[] = [
  { ticker: "AXIA7", issuerTicker: "AXIA3",
    reason: "Transitional PNC class (bonus issue Dec/2025) under a redemption/conversion programme into ON; the curated universe tracks AXIA3, the principal class. Not the successor of ELET6.",
    evidence: "B3: AXIA Energia (CD_CVM 2437) codes AXIA3, AXIA7; B3-OC 035/2026-VNC lists AXIA3 (ON) and AXIA7 (PNC) as the remaining classes" },
];
