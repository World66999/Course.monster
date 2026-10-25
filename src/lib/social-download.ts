import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Server-side client for the Bot9 downloader service.
 *
 * The service listens on 127.0.0.1 only and is never proxied by nginx, so the
 * browser cannot reach it: every request goes browser → Next.js → Bot9. The
 * shared secret lives only in the server environment and is never sent to the
 * client, which is why this file is `server-only`.
 *
 * The platform list and URL rules are duplicated here on purpose — not as a
 * second implementation, but as a cheap first gate so obviously-bad input never
 * leaves the website. Bot9's `links.detect_platform` remains authoritative and
 * re-validates everything.
 */

export const PLATFORMS = ["youtube", "facebook", "instagram", "tiktok", "pinterest"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  pinterest: "Pinterest",
};

/** Exact-host allowlist, mirroring Bot9's. Suffix matching would allow youtube.com.evil.com. */
const HOSTS: Record<Platform, string[]> = {
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"],
  facebook: ["facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com", "fb.watch"],
  instagram: ["instagram.com", "www.instagram.com"],
  tiktok: ["tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com", "m.tiktok.com"],
  pinterest: ["pinterest.com", "www.pinterest.com", "pin.it"],
};

const HOST_TO_PLATFORM = new Map<string, Platform>();
for (const p of PLATFORMS) for (const h of HOSTS[p]) HOST_TO_PLATFORM.set(h, p);

/**
 * Pinterest's country domains, as a fixed list — mirroring Bot9's
 * `links._PINTEREST_TLDS` exactly.
 *
 * This was previously `pinterest\.[a-z.]{2,8}`, which is not an allowlist at
 * all: it matches any TLD an attacker can register (`pinterest.tk`,
 * `pinterest.ml`) and, because the class includes a dot, it also matches
 * `pinterest.evil.com` — a host anyone owning evil.com can point at
 * 127.0.0.1 or a metadata endpoint. Bot9's own gate rejected every one of
 * those, so nothing was ever exploitable end to end, but this file is
 * documented as mirroring that gate and it did not.
 *
 * A fixed TLD list can never match an attacker-chosen host, which is the
 * property the loose pattern was missing.
 */
const PINTEREST_TLDS = [
  "com", "co.uk", "com.au", "com.mx", "co.kr", "ca", "de", "fr", "es", "it",
  "jp", "ch", "at", "nz", "ie", "se", "dk", "ph", "pt", "ru", "cl", "info",
  "nl", "be", "pl", "hu", "th", "vn", "id", "com.br",
] as const;

/** Optional 2-letter language prefix, optional www, then an allowlisted TLD. */
const PINTEREST_HOST = new RegExp(
  `^(?:[a-z]{2}\\.)?(?:www\\.)?pinterest\\.(?:${PINTEREST_TLDS.map((t) => t.replace(/\./g, "\\.")).join("|")})$`
);

const MAX_URL_LENGTH = 2048;

/**
 * Detects the platform, or null. Same posture as Bot9's SSRF gate: http(s)
 * only, exact host match, no credentials, no explicit port, no IP literal.
 */
export function detectPlatform(raw: string): Platform | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value || value.length > MAX_URL_LENGTH) return null;
  // Whitespace and C0 control characters (NUL, CR, LF, TAB ...). Written as
  // escapes on purpose: these used to be literal control BYTES in this source
  // file, invisible in editors, diffs and review -- one careless copy-paste
  // would have silently turned this check into something else.
  if (/[\s\u0000-\u001f]/.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (url.port) return null;

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  // Reject IP literals outright — they can only be an attempt to reach us.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":") || host.startsWith("[")) return null;

  if (PINTEREST_HOST.test(host)) return "pinterest";
  return HOST_TO_PLATFORM.get(host) ?? null;
}

/** Stable identifier for a URL without retaining the URL itself. */
export function hashUrl(url: string): string {
  return createHash("sha256").update(url.trim()).digest("hex");
}

export type SocialErrorCode =
  | "UNSUPPORTED_URL" | "PLATFORM_MISMATCH" | "PRIVATE_CONTENT" | "NOT_FOUND"
  | "RATE_LIMITED" | "TOO_LARGE" | "TIMEOUT" | "NO_CAPACITY"
  | "PLATFORM_ERROR" | "PLATFORM_UNAVAILABLE" | "UNAVAILABLE";

/** User-facing copy. Never a stack trace, path, command line or internal host. */
export const ERROR_MESSAGES: Record<SocialErrorCode, string> = {
  UNSUPPORTED_URL: "That URL isn't supported. Paste a link from YouTube, Facebook, Instagram, TikTok or Pinterest.",
  PLATFORM_MISMATCH: "That link doesn't match the platform you selected.",
  PRIVATE_CONTENT: "This content is private and cannot be downloaded.",
  NOT_FOUND: "We couldn't find that media. It may have been removed.",
  RATE_LIMITED: "That platform is temporarily limiting requests. Please try again shortly.",
  TOO_LARGE: "This file is too large for website delivery. Try the audio option instead.",
  TIMEOUT: "That took too long to prepare. Please try again.",
  NO_CAPACITY: "The downloader is busy right now. Please try again in a moment.",
  PLATFORM_ERROR: "The platform didn't return the media. Please try again later.",
  // Deliberately does NOT say "try again later". The platform is refusing this
  // server, not failing on one video, so a retry reaches the same answer and
  // only holds a worker on the way. Telling someone to retry into a wall is
  // worse than telling them it will not work.
  PLATFORM_UNAVAILABLE:
    "That platform is currently blocking downloads from this server. It's a restriction on their side, so retrying won't help — the other platforms are unaffected.",
  UNAVAILABLE: "Video downloading is temporarily unavailable. Please try again later.",
};

export function safeMessage(code: string | null | undefined): string {
  return ERROR_MESSAGES[(code ?? "PLATFORM_ERROR") as SocialErrorCode] ?? ERROR_MESSAGES.PLATFORM_ERROR;
}

/**
 * Non-fatal notes about a finished file.
 *
 * Separate from `ERROR_MESSAGES` because the job genuinely succeeded — the
 * download is real and worth keeping, there is just something about it the user
 * would otherwise blame on us.
 *
 * `NO_AUDIO` states a *fact about the delivered file* — it has no audio track —
 * and deliberately does not assert why. An earlier version of this copy claimed
 * "the source didn't publish an audio track", which is true for some media and
 * demonstrably false for others: Facebook holds the audio but serves this
 * server only video-only DASH renditions, so the audio exists and simply cannot
 * be retrieved from here. Stating a cause we cannot verify is how a warning
 * turns into a wrong answer, so the copy reports only what is certain.
 */
export type SocialWarningCode = "NO_AUDIO";

export const WARNING_MESSAGES: Record<SocialWarningCode, string> = {
  NO_AUDIO: "This video has no sound — no audio track could be retrieved for it.",
};

/**
 * Platform-specific follow-up, appended only where there is something true and
 * useful to add.
 *
 * Empty on purpose. It briefly carried a Facebook line telling people to try
 * the Telegram bot, because Facebook serves this server video-only renditions
 * and only the bot's transport could reach the audio. The downloader now
 * reaches that same transport itself, so a Facebook video arriving here silent
 * means the audio genuinely could not be had — and pointing at the bot would
 * send someone to a route that has already been tried on their behalf.
 *
 * Kept as a seam rather than deleted: the moment a platform does have a better
 * route we can name, this is where that goes.
 */
const WARNING_FOLLOW_UP: Partial<Record<Platform, string>> = {};

/**
 * Returns the note for a known warning code, or null. Never echoes the code.
 * `platform` is optional so callers that do not know it still get honest copy.
 */
export function safeWarning(
  code: string | null | undefined,
  platform?: string | null
): string | null {
  if (!code) return null;
  const base = WARNING_MESSAGES[code as SocialWarningCode];
  if (!base) return null;
  const extra =
    code === "NO_AUDIO" && platform
      ? WARNING_FOLLOW_UP[platform as Platform]
      : undefined;
  return extra ? `${base} ${extra}` : base;
}

function serviceUrl(): string | null {
  const base = process.env.SOCIAL_DOWNLOADER_URL?.replace(/\/+$/, "");
  return base && process.env.SOCIAL_DOWNLOADER_INTERNAL_SECRET ? base : null;
}

function authHeaders(ownerId: string): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.SOCIAL_DOWNLOADER_INTERNAL_SECRET}`,
    "X-Owner-Id": ownerId,
    "content-type": "application/json",
  };
}

export interface RemoteJob {
  id: string;
  platform: string;
  status: string;
  phase: string;
  percent: number | null;
  title: string | null;
  fileName: string | null;
  fileSize: number;
  errorCode: string | null;
  /** Non-fatal note about a COMPLETED artefact (see `safeWarning`). */
  warning: string | null;
}

type Result<T> = { ok: true; data: T } | { ok: false; code: SocialErrorCode };

/** All calls are bounded; the site must never hang because the service is wedged. */
const TIMEOUT_MS = 15_000;

/**
 * After this, a non-terminal job cannot still be running.
 *
 * A job row only reaches a terminal state when something polls it, so a member
 * who closes the tab leaves their own job sitting at PROCESSING for ever. That
 * is not merely untidy: the in-flight guard counts those rows, so two abandoned
 * jobs lock that member out of the downloader completely. The service's own
 * watchdog gives up at ten minutes, so anything older than this is finished one
 * way or another, whatever the row says.
 */
export const STALE_JOB_MS = 15 * 60_000;

export async function createRemoteJob(
  url: string,
  ownerId: string,
  audioOnly: boolean
): Promise<Result<RemoteJob>> {
  const base = serviceUrl();
  if (!base) return { ok: false, code: "UNAVAILABLE" };
  try {
    const res = await fetch(`${base}/jobs`, {
      method: "POST",
      headers: authHeaders(ownerId),
      body: JSON.stringify({ url, audioOnly }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, code: (body.error as SocialErrorCode) ?? "PLATFORM_ERROR" };
    return { ok: true, data: body as RemoteJob };
  } catch (err) {
    console.error("[social] create job failed:", err instanceof Error ? err.message : err);
    return { ok: false, code: "UNAVAILABLE" };
  }
}

export async function fetchRemoteJob(remoteId: string, ownerId: string): Promise<Result<RemoteJob>> {
  const base = serviceUrl();
  if (!base) return { ok: false, code: "UNAVAILABLE" };
  try {
    const res = await fetch(`${base}/jobs/${encodeURIComponent(remoteId)}`, {
      headers: authHeaders(ownerId),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.status === 404) return { ok: false, code: "NOT_FOUND" };
    if (!res.ok) return { ok: false, code: "PLATFORM_ERROR" };
    return { ok: true, data: (await res.json()) as RemoteJob };
  } catch {
    return { ok: false, code: "UNAVAILABLE" };
  }
}

/** Streams the artefact. The response body is piped straight through. */
export async function fetchRemoteFile(remoteId: string, ownerId: string): Promise<Response | null> {
  const base = serviceUrl();
  if (!base) return null;
  try {
    const res = await fetch(`${base}/jobs/${encodeURIComponent(remoteId)}/file`, {
      headers: { Authorization: `Bearer ${process.env.SOCIAL_DOWNLOADER_INTERNAL_SECRET}`, "X-Owner-Id": ownerId },
      // Large files: no client-side timeout on the body itself.
      cache: "no-store",
    });
    return res;
  } catch {
    return null;
  }
}

/**
 * Operator controls. Each one carries the *job owner's* id, not the operator's,
 * so an admin acts on someone's job without ever taking ownership of it — the
 * service's own ownership check stays the authority.
 */
export async function cancelRemoteJob(remoteId: string, ownerId: string): Promise<boolean> {
  const base = serviceUrl();
  if (!base) return false;
  try {
    const res = await fetch(`${base}/jobs/${encodeURIComponent(remoteId)}/cancel`, {
      method: "POST",
      headers: authHeaders(ownerId),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function retryRemoteJob(
  remoteId: string,
  ownerId: string
): Promise<Result<RemoteJob>> {
  const base = serviceUrl();
  if (!base) return { ok: false, code: "UNAVAILABLE" };
  try {
    const res = await fetch(`${base}/jobs/${encodeURIComponent(remoteId)}/retry`, {
      method: "POST",
      headers: authHeaders(ownerId),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, code: (body.error as SocialErrorCode) ?? "NOT_FOUND" };
    return { ok: true, data: body as RemoteJob };
  } catch {
    return { ok: false, code: "UNAVAILABLE" };
  }
}

export async function sweepRemote(): Promise<{ ok: boolean; detail: unknown }> {
  const base = serviceUrl();
  if (!base) return { ok: false, detail: "not configured" };
  try {
    const res = await fetch(`${base}/sweep`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.SOCIAL_DOWNLOADER_INTERNAL_SECRET}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    return { ok: true, detail: await res.json() };
  } catch {
    return { ok: false, detail: "unreachable" };
  }
}

export async function serviceHealth(): Promise<{ up: boolean; detail: unknown }> {
  const base = serviceUrl();
  if (!base) return { up: false, detail: "not configured" };
  try {
    const res = await fetch(`${base}/health`, {
      headers: { Authorization: `Bearer ${process.env.SOCIAL_DOWNLOADER_INTERNAL_SECRET}` },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return { up: false, detail: `HTTP ${res.status}` };
    return { up: true, detail: await res.json() };
  } catch (err) {
    return { up: false, detail: err instanceof Error ? err.message : "unreachable" };
  }
}

/** Constant-time compare, used where a caller-supplied token is checked. */
export function safeEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
