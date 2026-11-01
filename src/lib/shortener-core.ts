/**
 * Pure helpers for the shortener rotation — no env, no network, no database —
 * so they can be unit-tested directly.
 */

export const SHORTENER_PROVIDERS = ["vplink", "gplinks", "linkshortify"] as const;
export type ShortenerProvider = (typeof SHORTENER_PROVIDERS)[number];

export const PROVIDER_LABEL: Record<ShortenerProvider | "none", string> = {
  vplink: "VPLink",
  gplinks: "GPLinks",
  linkshortify: "LinkShortify",
  none: "Direct",
};

export function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Parse a shortener API response. Only `{"status":"success","shortenedUrl":…}`
 * (status may be omitted by VPLink, which has always been accepted) with an
 * http(s) URL counts; everything else is an error.
 */
export function extractShortUrl(body: string): string | null {
  let json: unknown;
  try {
    json = JSON.parse(body.trim());
  } catch {
    return null;
  }
  if (!json || typeof json !== "object") return null;
  const rec = json as Record<string, unknown>;
  if (rec.status !== undefined && (typeof rec.status !== "string" || rec.status.toLowerCase() !== "success")) {
    return null;
  }
  const url = rec.shortenedUrl;
  return typeof url === "string" && isValidHttpUrl(url) ? url : null;
}

/** The shortener for the n-th unlock of the day (1-based): VPLink, GPLinks, LinkShortify, repeat. */
export function providerForSlot(slot: number): ShortenerProvider {
  const i = (Math.max(1, Math.floor(slot)) - 1) % SHORTENER_PROVIDERS.length;
  return SHORTENER_PROVIDERS[i]!;
}

/**
 * The order to try shorteners in when `wanted` is due: the wanted one, then
 * the other ad shorteners, with VPLink always last unless it was the wanted
 * one. Disabled providers are left out (VPLink cannot be disabled).
 */
export function fallbackChain(
  wanted: ShortenerProvider,
  enabled: { gplinks: boolean; linkshortify: boolean }
): ShortenerProvider[] {
  const on = (p: ShortenerProvider) => p === "vplink" || enabled[p];
  const others = (["gplinks", "linkshortify"] as const).filter((p) => p !== wanted);
  const chain: ShortenerProvider[] = [wanted, ...others];
  if (wanted !== "vplink") chain.push("vplink");
  return chain.filter(on);
}

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** Calendar day in Asia/Kolkata (UTC+5:30, no DST) as YYYY-MM-DD. */
export function istDay(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The next midnight in Asia/Kolkata, as an absolute instant. */
export function nextIstMidnight(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  shifted.setUTCHours(24, 0, 0, 0);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

/** Effective daily limit: admin setting, else FREE_DAILY_COURSE_LIMIT, else 3. */
export function effectiveDailyLimit(setting: number | null | undefined, env: string | undefined): number {
  if (typeof setting === "number" && Number.isInteger(setting) && setting >= 1) return setting;
  const n = Number.parseInt(env ?? "", 10);
  return Number.isInteger(n) && n >= 1 && n <= 50 ? n : 3;
}

/** Today's count from a stored quota row: a row from an earlier day counts as 0. */
export function usedToday(row: { day: string; count: number } | null, today: string): number {
  return row && row.day === today ? row.count : 0;
}

/** Anti-abuse backup for anonymous visitors: free unlocks per IP per IST day. */
export const DEFAULT_IP_DAILY_CAP = 30;

export function effectiveIpDailyCap(setting: number | null | undefined): number {
  return typeof setting === "number" && Number.isInteger(setting) && setting >= 1 ? setting : DEFAULT_IP_DAILY_CAP;
}

/** The anonymous device cookie: random base64url, nothing else accepted. */
export function isValidDeviceId(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{20,64}$/.test(value);
}
