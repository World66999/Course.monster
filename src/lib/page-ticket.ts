import "server-only";

/**
 * Short-lived, single-use tickets proving a client actually loaded the
 * download page before calling /api/download/init — closes the gap where a
 * script could replay a captured request body directly against the API
 * without ever rendering the page.
 *
 * Tickets are minted in middleware (Edge runtime) and consumed in a Route
 * Handler (Node.js runtime), so — unlike download-token.ts, which only ever
 * runs in Node — this uses the Web Crypto API (`crypto.subtle`) throughout
 * instead of `node:crypto`: it's the one HMAC primitive available in both
 * runtimes. Single-use nonce tracking only ever happens on the consume side
 * (in the Node-side route handler), so it's fine that it's a plain in-memory
 * Map local to that module instance — same single-node rationale as
 * download-token.ts and rate-limit.ts.
 */

const TICKET_TTL_MS = 15 * 60 * 1000;

interface TicketPayload {
  slug: string;
  nonce: string;
  exp: number;
}

const usedNonces = new Map<string, number>();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + "=".repeat(padLen));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

let cachedKey: Promise<CryptoKey> | null = null;

function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const secret = process.env.DOWNLOAD_TOKEN_SECRET;
  if (!secret) throw new Error("DOWNLOAD_TOKEN_SECRET is not set");
  cachedKey = crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  return cachedKey;
}

export async function createPageTicket(slug: string): Promise<string> {
  const payload: TicketPayload = {
    slug,
    nonce: toBase64Url(crypto.getRandomValues(new Uint8Array(12))),
    exp: Date.now() + TICKET_TTL_MS,
  };
  const data = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return `${data}.${toBase64Url(new Uint8Array(sig))}`;
}

export type TicketVerifyResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "used" | "slug_mismatch" };

export async function consumePageTicket(token: string, slug: string): Promise<TicketVerifyResult> {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return { ok: false, reason: "invalid" };
  const data = token.slice(0, dot);
  const sigPart = token.slice(dot + 1);

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = fromBase64Url(sigPart);
  } catch {
    return { ok: false, reason: "invalid" };
  }

  const key = await getKey();
  // crypto.subtle.verify is constant-time by construction — no manual
  // timing-safe comparison needed (unlike download-token.ts's Node version).
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes as BufferSource,
    new TextEncoder().encode(data)
  );
  if (!valid) return { ok: false, reason: "invalid" };

  let payload: TicketPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(data)));
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (typeof payload.exp !== "number" || Date.now() > payload.exp) {
    return { ok: false, reason: "expired" };
  }
  if (payload.slug !== slug) {
    return { ok: false, reason: "slug_mismatch" };
  }

  const now = Date.now();
  for (const [nonce, exp] of usedNonces) {
    if (exp < now) usedNonces.delete(nonce);
  }
  if (usedNonces.has(payload.nonce)) {
    return { ok: false, reason: "used" };
  }
  usedNonces.set(payload.nonce, payload.exp);

  return { ok: true };
}
