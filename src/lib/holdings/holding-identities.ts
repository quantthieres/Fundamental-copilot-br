// Verified identities of the listed holdings covered by the holding model.
//
// Verified 2026-11-03 against:
//   - CVM cad_cia_aberta.csv (CD_CVM, CNPJ_CIA, SIT=ATIVO, Categoria A);
//   - CVM FCA 2026 valor_mobiliario (both trading codes under the same CNPJ,
//     no Data_Fim_Negociacao);
//   - B3 GetDetail (current codes and ISINs per issuer).
//
// One issuer → one canonical cache (the PN class, the issuer's most liquid
// code). The ON class reads the same issuer cache; market prices always stay
// ticker-specific. Itaúsa (CVM 7617) is NOT Itaú Unibanco (CVM 19348): the
// bank is an investee, never an alias.
//
// CSAN3 and GOAU4 are deliberately absent: they consolidate operating
// businesses and stay outside this model.
//
// No @/ imports — also used by tsx scripts.

import type { ShareClassKind, ShortTermInvestmentClassification } from "./holding-types";

export interface HoldingShareClassIdentity {
  ticker: string;
  kind: ShareClassKind;
  isin: string;
}

/**
 * A company-defined (ST_CONTA_FIXA = N) cash-flow line. The code alone is not
 * trusted: the row's description must normalize to one of `descriptions`.
 */
export interface IssuerAccountMapping {
  code: string;
  /** Verbatim DS_CONTA values seen in the official filings. */
  descriptions: readonly string[];
}

export interface HoldingIdentity {
  canonicalTicker: string;
  cvmCode: string;
  cnpj: string;
  /** DENOM_SOCIAL in the CVM registry. */
  legalName: string;
  shareClasses: readonly HoldingShareClassIdentity[];
  accounts: {
    dividendsReceived: IssuerAccountMapping;
    interestPaid: IssuerAccountMapping | null;
  };
  /** Treatment of CVM 1.01.02 Aplicações Financeiras (never cash). */
  shortTermInvestments: { classification: ShortTermInvestmentClassification; note: string };
}

export const VERIFIED_HOLDING_IDENTITIES: Readonly<Record<string, HoldingIdentity>> = {
  ITSA4: {
    canonicalTicker: "ITSA4",
    cvmCode: "7617",
    cnpj: "61.532.644/0001-15",
    legalName: "ITAUSA S.A.",
    shareClasses: [
      { ticker: "ITSA3", kind: "ON", isin: "BRITSAACNOR0" },
      { ticker: "ITSA4", kind: "PN", isin: "BRITSAACNPR7" },
    ],
    accounts: {
      // DFC_MI_ind, investing section. Seen in DFP 2024–2025 and ITR 2025–2026.
      dividendsReceived: { code: "6.02.07", descriptions: ["Juros sobre o capital próprio e Dividendos recebidos"] },
      interestPaid: { code: "6.01.03.02", descriptions: ["Juros pagos sobre Empréstimos, financiamentos e Debêntures"] },
    },
    shortTermInvestments: {
      classification: "portfolio_investment",
      note: "Itaúsa books its NTS stake at fair value under 1.01.02 (R$1.505bn at 2026-06-30, equal to the NTS line of the official portfolio) — a portfolio asset, not liquidity.",
    },
  },
  BRAP4: {
    canonicalTicker: "BRAP4",
    cvmCode: "18724",
    cnpj: "03.847.461/0001-92",
    legalName: "BRADESPAR S/A",
    shareClasses: [
      { ticker: "BRAP3", kind: "ON", isin: "BRBRAPACNOR5" },
      { ticker: "BRAP4", kind: "PN", isin: "BRBRAPACNPR2" },
    ],
    accounts: {
      // DFC_MI_ind, operating section. Both spellings appear (ITR Q1 omits "o").
      dividendsReceived: {
        code: "6.01.02.03",
        descriptions: [
          "Juros sobre o Capital Próprio e Dividendos Recebidos",
          "Juros sobre Capital Próprio e Dividendos Recebidos",
        ],
      },
      // No borrowings: the filings carry no interest-paid line.
      interestPaid: null,
    },
    shortTermInvestments: {
      classification: "unverified",
      note: "Bradespar reports 1.01.02 = 0; any future balance stays out of cash until classified.",
    },
  },
};

/** ON tickers that read their issuer's canonical holding cache. Never a market-price alias. */
export const HOLDING_CACHE_ALIASES: Readonly<Record<string, string>> = {
  ITSA3: "ITSA4",
  BRAP3: "BRAP4",
};

/** Canonical cache ticker for any share class of a covered holding, else null. */
export function resolveHoldingCacheTicker(ticker: string): string | null {
  const t = ticker.toUpperCase();
  if (VERIFIED_HOLDING_IDENTITIES[t]) return t;
  return HOLDING_CACHE_ALIASES[t] ?? null;
}

export function getHoldingIdentity(ticker: string): HoldingIdentity | null {
  const canonical = resolveHoldingCacheTicker(ticker);
  return canonical ? VERIFIED_HOLDING_IDENTITIES[canonical] : null;
}

/** True for every share class of a covered holding issuer. */
export function isHoldingIssuerTicker(ticker: string): boolean {
  return resolveHoldingCacheTicker(ticker) !== null;
}

/** Every share class of every covered holding issuer (ITSA3, ITSA4, BRAP3, BRAP4). */
export const HOLDING_SHARE_CLASS_TICKERS: readonly string[] = Object.values(VERIFIED_HOLDING_IDENTITIES)
  .flatMap(id => id.shareClasses.map(c => c.ticker));

/** Lowercase, accent-free, punctuation-free, without connective words. */
export function normalizeAccountDescription(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(w => w && !["o", "a", "os", "as", "e", "de", "do", "da", "dos", "das"].includes(w))
    .join(" ");
}

export function descriptionMatches(mapping: IssuerAccountMapping, description: string): boolean {
  const target = normalizeAccountDescription(description);
  return mapping.descriptions.some(d => normalizeAccountDescription(d) === target);
}
