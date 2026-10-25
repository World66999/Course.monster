import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Short-lived, single-use, user-bound tokens for opening a premium resource's
 * external link. The URL a member clicks is ours (/api/premium/resources/<id>/open?t=...),
 * expires in 60 seconds, works once, and only for the account it was minted
 * for — so copying it into a group chat gives nobody anything.
 *
 * Signed with DOWNLOAD_TOKEN_SECRET under its own domain prefix, so these can
 * never be confused with (or replayed as) download tokens.
 */

const TTL_MS = 60 * 1000;
const DOMAIN = "premium-link:v1:";
const used = new Map<string, number>();

function secret(): string {
  const s = process.env.DOWNLOAD_TOKEN_SECRET;
  if (!s) throw new Error("DOWNLOAD_TOKEN_SECRET is not set");
  return s;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(DOMAIN + data).digest("base64url");
}

export function createPremiumLinkToken(userId: string, resourceId: string): string {
  const data = Buffer.from(
    JSON.stringify({ u: userId, r: resourceId, n: randomBytes(9).toString("base64url"), e: Date.now() + TTL_MS })
  ).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function consumePremiumLinkToken(token: string, userId: string, resourceId: string): boolean {
  if (token.length > 512) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const data = token.slice(0, dot);
  const a = Buffer.from(token.slice(dot + 1));
  const b = Buffer.from(sign(data));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  let p: { u?: string; r?: string; n?: string; e?: number };
  try {
    p = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch {
    return false;
  }
  const now = Date.now();
  if (typeof p.e !== "number" || p.e < now || p.u !== userId || p.r !== resourceId || typeof p.n !== "string") {
    return false;
  }
  for (const [nonce, exp] of used) if (exp < now) used.delete(nonce);
  if (used.has(p.n)) return false;
  used.set(p.n, p.e);
  return true;
}
