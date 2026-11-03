// Batch-precompute helpers for scripts/precompute-cvm-cache.ts.
// No @/ imports — used by tsx scripts.

import { releaseDfpCompanyCache } from "./dfp-client";
import { releaseCvmDocumentsCache } from "./documents-client";

/** Releases every company-level CVM cache entry once a ticker is written. */
export function releaseCompanyCaches(ticker: string, cvmCode: string): void {
  releaseDfpCompanyCache(ticker, cvmCode);
  releaseCvmDocumentsCache(cvmCode);
}

/**
 * Runs one ticker's work and always releases its company caches afterwards,
 * whether the work succeeded or threw.
 */
export async function runWithCompanyCacheRelease<T>(
  ticker: string,
  cvmCode: string,
  work: () => Promise<T>,
  release: (ticker: string, cvmCode: string) => void = releaseCompanyCaches,
): Promise<T> {
  try {
    return await work();
  } finally {
    release(ticker, cvmCode);
  }
}

const MB = 1024 * 1024;

/** One-line memory summary, e.g. "heapUsed=42MB heapTotal=80MB rss=310MB external=25MB". */
export function formatMemoryUsage(usage: NodeJS.MemoryUsage = process.memoryUsage()): string {
  const f = (n: number) => `${Math.round(n / MB)}MB`;
  return `heapUsed=${f(usage.heapUsed)} heapTotal=${f(usage.heapTotal)} rss=${f(usage.rss)} external=${f(usage.external)}`;
}
