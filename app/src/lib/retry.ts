/** Exponential backoff with jitter for transient provider errors. */
export async function withBackoff<T>(
  fn: () => Promise<T>,
  options: { retries?: number; baseMs?: number; maxMs?: number; shouldRetry?: (err: unknown) => boolean } = {}
): Promise<T> {
  const retries = options.retries ?? 4;
  const baseMs = options.baseMs ?? 800;
  const maxMs = options.maxMs ?? 15_000;
  const shouldRetry =
    options.shouldRetry ??
    ((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      return /\b429\b|503|502|504|rate|ECONNRESET|fetch failed|timeout/i.test(msg);
    });

  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (attempt === retries || !shouldRetry(e)) throw e;
      const exp = Math.min(maxMs, baseMs * 2 ** attempt);
      const jitter = Math.floor(Math.random() * 400);
      await new Promise((r) => setTimeout(r, exp + jitter));
    }
  }
  throw last;
}
