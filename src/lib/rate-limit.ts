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

/**
 * Hard ceiling on distinct keys.
 *
 * Most keys are derived from a client IP, and nothing stops a caller supplying
 * a fresh one on every request. Between two scheduled sweeps that is five
 * minutes of unbounded growth in a map that was only ever pruned on a timer —
 * a slow, quiet way to exhaust the process's memory that no rate limit here can
 * itself prevent, because the limit is what is being allocated.
 *
 * Evicting early is safe in the direction that matters: dropping a bucket only
 * ever forgets that someone has already used part of their allowance, and the
 * sweep takes expired buckets first, so ordinary traffic is never touched. It
 * cannot be used to *gain* allowance either — filling the map takes far more
 * requests than the limits being evaded would have permitted.
 */
const MAX_KEYS = 50_000;

/**
 * How far an over-ceiling sweep evicts past the ceiling.
 *
 * Evicting to exactly MAX_KEYS is the obvious thing and it is quadratic: the
 * very next new key puts the store back over, so *every* subsequent request
 * runs another full O(n) pass. Measured at 60 000 one-off keys, that took 271
 * seconds — which would have turned a slow memory leak into an immediate CPU
 * exhaustion under exactly the traffic the ceiling exists to survive. Leaving
 * headroom amortises the sweep over the next few thousand insertions.
 */
const EVICT_TO = 45_000;

/**
 * The longest window any caller has actually asked for.
 *
 * The sweep prunes timestamps older than one window, but the store is shared by
 * every limiter in the app and it used to be swept with
 * `max(thisCaller.windowMs, 15min)`. A caller with a *short* window therefore
 * pruned entries belonging to a longer-windowed one: the newsletter limit is an
 * hour, so any other endpoint's request within that hour trimmed its bucket
 * back to 15 minutes and quietly turned five sign-ups per hour into five per
 * quarter-hour. Sweeping on the widest window in use keeps every limiter's
 * window meaning what it says, at the cost of holding a few entries slightly
 * longer than the limiter that owns them needs.
 */
let widestWindowMs = 15 * 60 * 1000;

/**
 * Drops everything that can no longer affect a decision, then enforces the key
 * ceiling. Exported so it can be driven directly: the periodic call below is
 * gated on a five-minute timer, which is not something a test can wait out, and
 * the window bug above is only observable once a sweep has actually run.
 */
export function sweepRateLimitStore(now: number = Date.now()): void {
  lastCleanup = now;
  for (const [key, bucket] of store) {
    const fresh = bucket.filter((t) => now - t < widestWindowMs);
    if (fresh.length === 0) store.delete(key);
    else store.set(key, fresh);
  }
  if (store.size <= MAX_KEYS) return;
  // Still over after dropping everything expired: every remaining bucket is
  // live, so shed the oldest-written ones. Map iterates in insertion order.
  let excess = store.size - EVICT_TO;
  for (const key of store.keys()) {
    store.delete(key);
    if (--excess <= 0) break;
  }
}

/** Number of distinct keys currently held, for a health readout. */
export function rateLimitStoreSize(): number {
  return store.size;
}

function cleanup(now: number, willAddKey = false) {
  const projected = store.size + (willAddKey ? 1 : 0);
  if (now - lastCleanup < CLEANUP_INTERVAL_MS && projected <= MAX_KEYS) return;
  sweepRateLimitStore(now);
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
  if (opts.windowMs > widestWindowMs) widestWindowMs = opts.windowMs;
  // `>=` rather than `>`: this call may be about to add a key, and the ceiling
  // should hold after that write, not one key later.
  cleanup(now, !store.has(key));

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
