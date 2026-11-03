// Shared HTTP helper for the macro precompute (never used on request paths).
//
// No @/ imports — also used by tsx scripts.

export interface FetchTextOptions {
  timeoutMs?: number;
  retries?: number;
  accept?: string;
}

/** GET with timeout and bounded retries; throws on non-2xx after retries. */
export async function fetchTextWithRetry(url: string, opts: FetchTextOptions = {}): Promise<string> {
  const { timeoutMs = 120_000, retries = 2, accept } = opts;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: accept ? { Accept: accept } : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      lastError = err;
      if (attempt < retries) await new Promise(r => setTimeout(r, 2_000 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
