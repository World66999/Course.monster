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
  /** Descriptive attribution only ("telegram"); never an authorization input. */
  src?: string;
  /** Telegram user id when `src` is "telegram". */
  tgId?: string;
  /**
   * Premium instant download: /go sends the visitor straight to the course's
   * destination instead of the ad-supported short link. Only ever set by
   * the download page or /api/download/premium after a server-side Premium check; it is inside the
   * signed payload, so a client cannot add it.
   */
  direct?: true;
  /**
   * The signed-in user the token was minted for. Required on direct tokens
   * and premium-course tokens: /go re-reads that user's access from the
   * database, so a link copied while Premium stops working once it ends.
   */
  uid?: string;
  /**
   * Free path: the pending unlock attempt whose short link /go redirects to
   * (see free-unlocks.ts). Set only by /api/download/init after every gate.
   */
  us?: string;
  /**
   * Free path, course already unlocked: the subject key that unlocked it. /go
   * re-checks the unlock record before sending the visitor to the course.
   */
  ro?: string;
}

export interface DownloadAttribution {
  source: string;
  telegramUserId: string;
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

export function createDownloadToken(
  courseId: string,
  ipHash: string,
  attribution?: DownloadAttribution,
  opts: { direct?: boolean; userId?: string; unlockSessionId?: string; reopenSubject?: string } = {}
): string {
  const payload: TokenPayload = {
    courseId,
    ipHash,
    nonce: randomBytes(12).toString("base64url"),
    exp: Date.now() + TOKEN_TTL_MS,
    ...(attribution ? { src: attribution.source, tgId: attribution.telegramUserId } : {}),
    ...(opts.direct ? { direct: true as const } : {}),
    ...(opts.userId ? { uid: opts.userId } : {}),
    ...(opts.unlockSessionId ? { us: opts.unlockSessionId } : {}),
    ...(opts.reopenSubject ? { ro: opts.reopenSubject } : {}),
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export type TokenVerifyResult =
  | {
      ok: true;
      courseId: string;
      direct: boolean;
      userId: string | null;
      unlockSessionId: string | null;
      reopenSubject: string | null;
      attribution?: DownloadAttribution;
    }
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

  return {
    ok: true,
    courseId: payload.courseId,
    direct: payload.direct === true,
    userId: typeof payload.uid === "string" ? payload.uid : null,
    unlockSessionId: typeof payload.us === "string" ? payload.us : null,
    reopenSubject: typeof payload.ro === "string" ? payload.ro : null,
    ...(typeof payload.src === "string" && typeof payload.tgId === "string"
      ? { attribution: { source: payload.src, telegramUserId: payload.tgId } }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Bot hand-off for Premium members
// ---------------------------------------------------------------------------

/**
 * A Premium member asking the bot for a download gets a /dl/<token> link
 * instead of the steps page: they aren't signed in to the website inside
 * Telegram, so the token itself names the linked account. It is bound to that
 * user and course, lives HANDOFF_TTL_MS, and grants nothing on its own — /dl
 * re-reads the user's access from the database every time it is opened, so a
 * copied link dies with the membership.
 */
const HANDOFF_TTL_MS = 10 * 60 * 1000;
const HANDOFF_DOMAIN = "premium-handoff:";

interface HandoffPayload {
  uid: string;
  courseId: string;
  tgId: string;
  exp: number;
}

export function createHandoffToken(userId: string, courseId: string, telegramUserId: string, now = Date.now()): string {
  const payload: HandoffPayload = { uid: userId, courseId, tgId: telegramUserId, exp: now + HANDOFF_TTL_MS };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(HANDOFF_DOMAIN + data)}`;
}

export function verifyHandoffToken(
  token: string,
  now = Date.now()
): { ok: true; userId: string; courseId: string; telegramUserId: string } | { ok: false; reason: "invalid" | "expired" } {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return { ok: false, reason: "invalid" };
  const data = token.slice(0, dot);
  const a = Buffer.from(token.slice(dot + 1));
  const b = Buffer.from(sign(HANDOFF_DOMAIN + data));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "invalid" };
  let p: HandoffPayload;
  try {
    p = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (typeof p.uid !== "string" || typeof p.courseId !== "string" || typeof p.tgId !== "string") {
    return { ok: false, reason: "invalid" };
  }
  if (typeof p.exp !== "number" || now > p.exp) return { ok: false, reason: "expired" };
  return { ok: true, userId: p.uid, courseId: p.courseId, telegramUserId: p.tgId };
}
