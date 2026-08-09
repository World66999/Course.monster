import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, short-lived download-attribution token.
 *
 * This exists so the admin funnel can end at a *genuinely completed* download
 * instead of "we sent someone a link". It is descriptive metadata only:
 * nothing in the download flow consults it for authorisation, it never selects
 * a course, and an absent/invalid token simply means the download is recorded
 * unattributed. It can therefore never be used to reach a course the normal
 * flow would have refused.
 */

const TTL_MS = 30 * 60 * 1000;

interface Payload {
  /** Telegram user id. */
  t: string;
  /** Course id the link was issued for — cross-checked at redemption. */
  c: string;
  exp: number;
}

/**
 * Domain-separated from the /go redirect token: same configured secret, a
 * different derived key, so a token minted for one purpose can never validate
 * for the other.
 */
function key(): Buffer {
  const base = process.env.DOWNLOAD_TOKEN_SECRET;
  if (!base) throw new Error("DOWNLOAD_TOKEN_SECRET is not set");
  return createHmac("sha256", base).update("telegram-attribution-v1").digest();
}

function sign(data: string): string {
  return createHmac("sha256", key()).update(data).digest("base64url");
}

export function createAttributionToken(telegramId: string, courseId: string): string {
  const payload: Payload = { t: telegramId, c: courseId, exp: Date.now() + TTL_MS };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

/** Returns the Telegram user id when the token is valid for `courseId`. */
export function verifyAttributionToken(token: string, courseId: string): string | null {
  if (typeof token !== "string" || token.length > 512) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  let expected: Buffer;
  let given: Buffer;
  try {
    expected = Buffer.from(sign(data), "base64url");
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as Payload;
  } catch {
    return null;
  }
  if (typeof payload.t !== "string" || typeof payload.c !== "string") return null;
  if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;
  // A token minted for a different course must not attribute this one.
  if (payload.c !== courseId) return null;
  return payload.t;
}
