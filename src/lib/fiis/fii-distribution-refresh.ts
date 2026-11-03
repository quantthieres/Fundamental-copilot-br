// Per-ticker Fundos.Net refresh for fii:precompute.
// Precompute-time only (network via fii-fnet-client); fetch is injectable.
//
// Failure isolation per ticker: when Fundos.Net fails technically, the fresh
// CVM records (NAV, quotas, diagnostic estimate) are still written, and the
// distributions already validated in the committed cache — with their
// provenance — are carried over unchanged. No month gains a distribution that
// the previous cache did not have. Other tickers and other cache families are
// unaffected. Distributions are never estimated.

import { fetchFundDistributionNotices, type FetchLike } from "./fii-fnet-client";
import {
  enrichWithFnet,
  fnetEnrichmentFailed,
  fnetTechnicalFailure,
  hasFnetDistributions,
  mergeDistributions,
  type FiiFundIdentity,
  type MonthlyFnetDistribution,
} from "./fii-distributions";
import type { FiiAnalysisResponse, FiiDistributionEnrichment, FiiFinancialRecord } from "./fii-types";

export interface FiiDistributionRefresh {
  records: FiiFinancialRecord[];
  enrichment: FiiDistributionEnrichment;
  warnings: string[];
}

// Shown in the panel; the technical reason stays in distributionEnrichment.issues.
export const FNET_UNAVAILABLE_WARNING =
  "Rendimentos da B3 (Fundos.Net) indisponíveis nesta atualização — distribuições não exibidas.";
export const FNET_PRESERVED_WARNING =
  "Rendimentos da B3 (Fundos.Net) indisponíveis nesta atualização — mantidos os rendimentos já publicados.";

// Notices delivered from two months before the first record onwards cover
// every cached month (a month's notice is filed in that month or the next).
export function noticeSinceDate(firstReferenceDate: string): string {
  return new Date(Date.UTC(Number(firstReferenceDate.slice(0, 4)), Number(firstReferenceDate.slice(5, 7)) - 3, 1))
    .toISOString().slice(0, 10);
}

/** Fundos.Net months of a committed cache, exactly as validated then. */
export function previousFnetMonths(previous: FiiAnalysisResponse | null): Map<string, MonthlyFnetDistribution> {
  const out = new Map<string, MonthlyFnetDistribution>();
  for (const r of previous?.available ? previous.records : []) {
    const fromFnet = r.distributionSource === "fnet_structured";
    if (!fromFnet && r.monthlyAmortizationPerShare == null) continue;
    const month = r.referenceDate.slice(0, 7);
    out.set(month, {
      month,
      distributionPerShare: fromFnet ? r.monthlyDistributionPerShare ?? null : null,
      amortizationPerShare: r.monthlyAmortizationPerShare ?? null,
      baseDate: r.distributionBaseDate ?? null,
      paymentDate: r.distributionPaymentDate ?? null,
      documentIds: [...(r.fnetDocumentIds ?? [])],
    });
  }
  return out;
}

export async function refreshFiiDistributions(args: {
  identity: FiiFundIdentity;
  cvmRecords: FiiFinancialRecord[];
  previous: FiiAnalysisResponse | null;
  fetchImpl?: FetchLike;
  delayMs?: number;
}): Promise<FiiDistributionRefresh> {
  const { identity, cvmRecords, previous, fetchImpl, delayMs } = args;
  if (cvmRecords.length === 0) {
    return { ...fnetEnrichmentFailed(identity, cvmRecords, "no CVM records"), warnings: [] };
  }

  let failure: string | null;
  try {
    const { notices, rejectedRows } = await fetchFundDistributionNotices(
      identity.cnpj, noticeSinceDate(cvmRecords[0].referenceDate), fetchImpl, delayMs,
    );
    failure = fnetTechnicalFailure(notices);
    if (!failure && notices.length === 0 && hasFnetDistributions(previous)) {
      failure = "Fundos.Net listed no notices although the committed cache has Fundos.Net months";
    }
    if (!failure) {
      const result = enrichWithFnet(identity, cvmRecords, notices);
      if (rejectedRows > 0) result.enrichment.issues.unshift(`${rejectedRows} listing row(s) were not distribution notices`);
      return { ...result, warnings: [] };
    }
  } catch (err) {
    failure = err instanceof Error ? err.message : String(err);
  }

  if (!hasFnetDistributions(previous)) {
    return { ...fnetEnrichmentFailed(identity, cvmRecords, failure!), warnings: [FNET_UNAVAILABLE_WARNING] };
  }
  const kept = previousFnetMonths(previous);
  const records = mergeDistributions(cvmRecords, kept);
  const used = new Set(records.flatMap(r => r.fnetDocumentIds ?? []));
  return {
    records,
    enrichment: {
      source: "fnet_structured",
      status: "preserved",
      isin: identity.isin,
      noticesListed: 0,
      noticesUsed: used.size,
      issues: [`Fundos.Net unavailable (${failure}); prior authoritative distribution data preserved`],
    },
    warnings: [FNET_PRESERVED_WARNING],
  };
}
