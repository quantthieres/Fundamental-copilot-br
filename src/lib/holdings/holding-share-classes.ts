// Share classes of a holding issuer from CVM composicao_capital.
//
// The CVM file publishes thousands of shares per class (ordinary / preferred)
// for each filed period. For Itaúsa and Bradespar this matches the issuers'
// own publications (Itaúsa 11,207 mn ex-treasury; Bradespar 137,989,898 ON +
// 255,106,712 PN), cross-checked in the precompute diagnostics.
//
// No @/ imports — also used by tsx scripts.

import type { CvmCapitalEntry } from "./holding-cvm-rows";
import type { HoldingIdentity } from "./holding-identities";
import type { HoldingShareClass } from "./holding-types";

export interface CapitalSnapshot extends CvmCapitalEntry {
  document: "DFP" | "ITR";
}

/** Highest version of the latest period. */
export function latestCapital(entries: readonly CapitalSnapshot[]): CapitalSnapshot | null {
  let best: CapitalSnapshot | null = null;
  for (const e of entries) {
    if (!best || e.periodEnd > best.periodEnd || (e.periodEnd === best.periodEnd && e.version > best.version)) best = e;
  }
  return best;
}

export function buildShareClasses(
  identity: HoldingIdentity,
  capital: CapitalSnapshot | null,
): HoldingShareClass[] {
  return identity.shareClasses.map(sc => {
    if (!capital) {
      return { ticker: sc.ticker, kind: sc.kind, isin: sc.isin, issuedShares: null, treasuryShares: null,
        outstandingShares: null, referenceDate: null, source: null };
    }
    const issued = sc.kind === "ON" ? capital.issuedOn : capital.issuedPn;
    const treasury = sc.kind === "ON" ? capital.treasuryOn : capital.treasuryPn;
    return {
      ticker: sc.ticker,
      kind: sc.kind,
      isin: sc.isin,
      issuedShares: issued,
      treasuryShares: treasury,
      outstandingShares: issued - treasury,
      referenceDate: capital.periodEnd,
      source: capital.document === "ITR" ? "cvm_itr_composicao_capital" : "cvm_dfp_composicao_capital",
    };
  });
}

/** Σ outstanding shares over every class, or null when any class is unknown. */
export function totalOutstandingShares(classes: readonly HoldingShareClass[]): number | null {
  let total = 0;
  for (const c of classes) {
    if (c.outstandingShares === null) return null;
    total += c.outstandingShares;
  }
  return total;
}
