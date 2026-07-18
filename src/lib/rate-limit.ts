/**
 * Sliding-window rate limiter.
 *
 * Uses an in-memory store, which is correct for a single-node deployment
 * (the standard setup for this app: one Next.js process behind Nginx).
 * If you scale to multiple nodes, replace the store with Redis using the
 * same interface (see docs/DEPLOYMENT.md).
 */

type Bucket = number[];

const store = new Map<string, Bucket>();

// Periodically drop stale buckets so memory stays bounded.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(now: number, maxWindowMs: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of store) {
    const fresh = bucket.filter((t) => now - t < maxWindowMs);
    if (fresh.length === 0) store.delete(key);
    else store.set(key, fresh);
  }
}

export interface RateLimitOptions {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Milliseconds until the oldest request leaves the window. */
  retryAfterMs: number;
}

export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  cleanup(now, Math.max(opts.windowMs, 15 * 60 * 1000));

  const bucket = (store.get(key) ?? []).filter((t) => now - t < opts.windowMs);
  if (bucket.length >= opts.limit) {
    store.set(key, bucket);
    return {
      ok: false,
      remaining: 0,
      retryAfterMs: opts.windowMs - (now - bucket[0]),
    };
  }
  bucket.push(now);
  store.set(key, bucket);
  return { ok: true, remaining: opts.limit - bucket.length, retryAfterMs: 0 };
}
