// Verified CVM identities for the bank and insurance sector models.
//
// The bank/insurance precompute scripts resolve the CVM entity from this map.
// Fuzzy registry name matching is a fallback for manual investigation only
// (SECTOR_ALLOW_FUZZY_CVM_MATCH=1) and can never override an entry here.
//
// Verified 2026-11-02 against the CVM registry (cad_cia_aberta.csv: CD_CVM,
// CNPJ_CIA, SIT=ATIVO, Categoria A) and FCA 2026 valor_mobiliario (ticker
// listed under the same CNPJ, no Data_Fim_Negociacao). Each code also matches
// the cvmCode already recorded in the committed sector caches.
//
// SULA11 is intentionally absent: SulAmérica was incorporated by Rede D'Or
// (2022) and stays unavailable.
//
// No @/ imports — also used by tsx scripts.

export type SectorModel = "bank" | "insurance";

export interface VerifiedSectorIdentity {
  ticker: string;
  model: SectorModel;
  cvmCode: string;
  cnpj: string;
  /** DENOM_SOCIAL in the CVM registry. */
  legalName: string;
  note?: string;
}

export const VERIFIED_BANK_IDENTITIES: Readonly<Record<string, VerifiedSectorIdentity>> = {
  ITUB4:  { ticker: "ITUB4",  model: "bank", cvmCode: "19348", cnpj: "60.872.504/0001-23", legalName: "ITAÚ UNIBANCO HOLDING S.A.",
            note: "Same CNPJ also has a CANCELADA record (CD_CVM 1279, 1998) — not to be used." },
  BBDC4:  { ticker: "BBDC4",  model: "bank", cvmCode: "906",   cnpj: "60.746.948/0001-12", legalName: "BANCO BRADESCO S.A." },
  BBAS3:  { ticker: "BBAS3",  model: "bank", cvmCode: "1023",  cnpj: "00.000.000/0001-91", legalName: "BANCO DO BRASIL S.A." },
  SANB11: { ticker: "SANB11", model: "bank", cvmCode: "20532", cnpj: "90.400.888/0001-42", legalName: "BANCO SANTANDER (BRASIL) S.A." },
  BPAC11: { ticker: "BPAC11", model: "bank", cvmCode: "22616", cnpj: "30.306.294/0001-45", legalName: "BANCO BTG PACTUAL S/A",
            note: "FCA 2026 lists the Units (1 ON + 2 PNA, since 2012-04-26) with Codigo_Negociacao \"000000\"; only active Categoria A BTG issuer." },
  BRSR6:  { ticker: "BRSR6",  model: "bank", cvmCode: "1210",  cnpj: "92.702.067/0001-96", legalName: "BANCO DO ESTADO DO RIO GRANDE DO SUL SA" },
};

export const VERIFIED_INSURANCE_IDENTITIES: Readonly<Record<string, VerifiedSectorIdentity>> = {
  BBSE3: { ticker: "BBSE3", model: "insurance", cvmCode: "23159", cnpj: "17.344.597/0001-94", legalName: "BB SEGURIDADE PARTICIPAÇÕES S.A." },
  PSSA3: { ticker: "PSSA3", model: "insurance", cvmCode: "16659", cnpj: "02.149.205/0001-69", legalName: "PORTO SEGURO SA" },
  IRBR3: { ticker: "IRBR3", model: "insurance", cvmCode: "24180", cnpj: "33.376.989/0001-91", legalName: "IRB - BRASIL RESSEGUROS S.A." },
  CXSE3: { ticker: "CXSE3", model: "insurance", cvmCode: "23795", cnpj: "22.543.331/0001-00", legalName: "CAIXA SEGURIDADE PARTICIPAÇÕES S.A." },
};

const BY_MODEL: Record<SectorModel, Readonly<Record<string, VerifiedSectorIdentity>>> = {
  bank: VERIFIED_BANK_IDENTITIES,
  insurance: VERIFIED_INSURANCE_IDENTITIES,
};

export function getVerifiedSectorIdentity(
  ticker: string,
  model: SectorModel,
): VerifiedSectorIdentity | null {
  return BY_MODEL[model][ticker.toUpperCase()] ?? null;
}

export type SectorCvmResolution =
  | { cvmCode: string; source: "verified"; identity: VerifiedSectorIdentity }
  | { cvmCode: string; source: "fuzzy_fallback" }
  | null;

/**
 * Resolves the CVM code for a sector-model ticker.
 *
 * - A verified identity always wins; `fuzzyMatch` is not even called.
 * - Without a verified identity, the fuzzy matcher is used only when
 *   `allowFuzzyFallback` is true (manual investigation); otherwise null.
 */
export function resolveSectorCvmCode(
  ticker: string,
  model: SectorModel,
  options: { allowFuzzyFallback: boolean; fuzzyMatch: () => string | null },
): SectorCvmResolution {
  const identity = getVerifiedSectorIdentity(ticker, model);
  if (identity) return { cvmCode: identity.cvmCode, source: "verified", identity };
  if (!options.allowFuzzyFallback) return null;
  const code = options.fuzzyMatch();
  return code ? { cvmCode: code, source: "fuzzy_fallback" } : null;
}

function normalizeCvmCode(code: string): string {
  return code.trim().replace(/^0+(?=\d)/, "");
}

function normalizeCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

/**
 * Confirms the live CVM registry still describes the verified issuer: an
 * ATIVO record with the verified CD_CVM and CNPJ. Also used for the holding
 * identities (holdings/holding-identities.ts). Returns a problem
 * description, or null when the identity is confirmed.
 */
export function checkRegistryIdentity(
  identity: Pick<VerifiedSectorIdentity, "cvmCode" | "cnpj">,
  registry: readonly { cvmCode: string; cnpj: string; status: string }[],
): string | null {
  const records = registry.filter(r => normalizeCvmCode(r.cvmCode) === normalizeCvmCode(identity.cvmCode));
  if (records.length === 0) {
    return `CVM code ${identity.cvmCode} not found in the CVM registry`;
  }
  const match = records.find(r => normalizeCnpj(r.cnpj) === normalizeCnpj(identity.cnpj));
  if (!match) {
    return `CVM code ${identity.cvmCode} is registered under CNPJ ${records[0].cnpj}, expected ${identity.cnpj}`;
  }
  if (match.status !== "ATIVO") {
    return `CVM code ${identity.cvmCode} has registry status ${match.status || "(empty)"}, expected ATIVO`;
  }
  return null;
}
