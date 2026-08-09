import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/**
 * Strips an optional `:port` suffix and `[...]` bracketing (used to
 * disambiguate IPv6 colons from a port separator) and any IPv6 zone id.
 * A bracketed value's port comes *after* the closing bracket (`[::1]:8080`),
 * so it must be located by the bracket, not by splitting on `:` — that
 * would mangle the address itself for any real IPv6 value.
 */
function stripPortAndZone(value: string): string {
  if (value.startsWith("[")) {
    const end = value.indexOf("]");
    return end === -1 ? value : value.slice(1, end).split("%")[0]!;
  }
  // Unbracketed: a single colon means "ip:port" (IPv4); two or more means a
  // raw (unbracketed, portless) IPv6 address, which must be left untouched.
  const colonCount = (value.match(/:/g) ?? []).length;
  const withoutPort = colonCount === 1 ? value.split(":")[0]! : value;
  return withoutPort.split("%")[0]!;
}

/**
 * Loose sanity check — not a strict IPv4/IPv6 validator, just enough to
 * reject an empty/garbage header value before it gets hashed into a
 * rate-limit or audit-log key.
 */
function looksLikeIp(value: string): boolean {
  return /^[0-9a-fA-F.:]{2,45}$/.test(value);
}

/** Extracts and validates a candidate address, handling port/bracket/zone noise. */
function cleanCandidate(raw: string): string | null {
  const cleaned = stripPortAndZone(raw.trim());
  return looksLikeIp(cleaned) ? cleaned : null;
}

/** Parses the first `for=` entry from an RFC 7239 `Forwarded` header. */
function parseForwardedFor(value: string): string | null {
  const firstHop = value.split(",")[0] ?? "";
  const match = /for=("?)([^;,\s]+?)\1(?=[;,\s]|$)/i.exec(firstHop);
  if (!match) return null;
  return cleanCandidate(match[2]!);
}

/**
 * Resolve the real client IP behind a reverse proxy.
 *
 * This process is only ever reachable through the configured reverse
 * proxy (bound to 127.0.0.1 / firewalled to the proxy's network) — a
 * request that reaches this code has already passed through a proxy that
 * is expected to set one of these headers. Checked in order of
 * reliability, so this works "as-is" behind Cloudflare, plain Nginx,
 * HAProxy, Caddy, or Traefik without per-proxy configuration:
 *
 *   1. CF-Connecting-IP — set directly by Cloudflare's edge on the
 *      request to the origin; a client cannot forge this (Cloudflare
 *      overwrites it), so it's trusted first whenever Cloudflare is in
 *      front, independent of how the origin's own reverse proxy handles
 *      X-Forwarded-For.
 *   2. Forwarded (RFC 7239) — the standardized `for=` directive some
 *      proxies (HAProxy, Caddy) emit instead of/alongside X-Forwarded-For.
 *   3. X-Forwarded-For — the de-facto standard; takes the first (leftmost)
 *      entry, the original client in a multi-hop chain. Our Nginx config
 *      sets this to the already-resolved real client IP rather than
 *      appending to a client-supplied chain (see nginx/coursevault.conf).
 *   4. X-Real-IP — simple proxy configs that only set this one header.
 *
 * None of these can be verified against the raw TCP peer from within a
 * Next.js Route Handler/Middleware (the framework doesn't expose the
 * socket address in a self-hosted deployment) — the real trust boundary
 * is that this process is unreachable except through the proxy, enforced
 * at the network layer (bind address + firewall), not in this function.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();

  const cf = h.get("cf-connecting-ip");
  if (cf) {
    const cleaned = cleanCandidate(cf);
    if (cleaned) return cleaned;
  }

  const forwarded = h.get("forwarded");
  if (forwarded) {
    const parsed = parseForwardedFor(forwarded);
    if (parsed) return parsed;
  }

  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0];
    const cleaned = first ? cleanCandidate(first) : null;
    if (cleaned) return cleaned;
  }

  const xri = h.get("x-real-ip");
  if (xri) {
    const cleaned = cleanCandidate(xri);
    if (cleaned) return cleaned;
  }

  return "unknown";
}

/**
 * Whether the original client request was HTTPS, per the reverse proxy's
 * X-Forwarded-Proto (standard across Nginx/HAProxy/Caddy/Traefik/
 * Cloudflare). Prefer `request.nextUrl.protocol === "https:"` when a
 * NextRequest is available (middleware, Route Handlers) — Next.js already
 * derives that from the same header. This helper exists for contexts
 * without a NextRequest (e.g. Server Actions, which only have `headers()`).
 */
export async function isHttps(): Promise<boolean> {
  const h = await headers();
  return h.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase() === "https";
}

/** Privacy-preserving IP hash for analytics/rate keys stored in the DB. */
export function hashIp(ip: string): string {
  const salt = process.env.DOWNLOAD_TOKEN_SECRET ?? "static-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/**
 * Canonical public origin, behind a reverse proxy. Same fallback chain
 * auth.config.ts uses to build redirects. `requestOrigin` (e.g.
 * `request.nextUrl.origin`) is the last resort when neither env var is set.
 */
export function siteOrigin(requestOrigin: string): string {
  return process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? requestOrigin;
}

/**
 * Cheap same-origin defense-in-depth for plain Route Handlers (which, unlike
 * Server Actions, have no built-in CSRF protection). Only rejects when the
 * header is present and wrong — some browsers/extensions legitimately omit
 * it, so an absent header is not itself treated as suspicious.
 */
export function isTrustedOrigin(originOrReferer: string | null, requestOrigin: string): boolean {
  if (!originOrReferer) return true;
  try {
    return new URL(originOrReferer).origin === new URL(siteOrigin(requestOrigin)).origin;
  } catch {
    return false;
  }
}
