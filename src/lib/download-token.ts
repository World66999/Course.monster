import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Short-lived, single-use HMAC tokens for the /go/[token] redirect step.
 * Tokens bind a course to an IP hash and expire after TOKEN_TTL_MS, so the
 * redirect URL can't be usefully shared or replayed. Single-use tracking is
 * in-memory, matching the single-node deployment model.
 */

const TOKEN_TTL_MS = 90 * 1000;

interface TokenPayload {
  courseId: string;
  ipHash: string;
  nonce: string;
  exp: number;
}

const usedNonces = new Map<string, number>();

function secret(): string {
  const s = process.env.DOWNLOAD_TOKEN_SECRET;
  if (!s) throw new Error("DOWNLOAD_TOKEN_SECRET is not set");
  return s;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createDownloadToken(courseId: string, ipHash: string): string {
  const payload: TokenPayload = {
    courseId,
    ipHash,
    nonce: randomBytes(12).toString("base64url"),
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export type TokenVerifyResult =
  | { ok: true; courseId: string }
  | { ok: false; reason: "invalid" | "expired" | "used" | "ip_mismatch" };

export function consumeDownloadToken(token: string, ipHash: string): TokenVerifyResult {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return { ok: false, reason: "invalid" };
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const expected = sign(data);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "invalid" };
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (typeof payload.exp !== "number" || Date.now() > payload.exp) {
    return { ok: false, reason: "expired" };
  }
  if (payload.ipHash !== ipHash) {
    return { ok: false, reason: "ip_mismatch" };
  }

  // Single use: reject nonces we've already seen (and purge expired ones).
  const now = Date.now();
  for (const [nonce, exp] of usedNonces) {
    if (exp < now) usedNonces.delete(nonce);
  }
  if (usedNonces.has(payload.nonce)) {
    return { ok: false, reason: "used" };
  }
  usedNonces.set(payload.nonce, payload.exp);

  return { ok: true, courseId: payload.courseId };
}
