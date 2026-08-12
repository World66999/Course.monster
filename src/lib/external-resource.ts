/**
 * Shared rules for the two admin-curated, link-out-only directories
 * (Free Resources and Free AI Platforms).
 *
 * Both sections store an external URL that is rendered straight into an
 * `href`. Neither section ever fetches, mirrors, proxies or hosts the target:
 * the server never makes a request to an admin-supplied URL, so this feature
 * adds no SSRF surface. Everything below is therefore pure string/URL work.
 *
 * Two jobs:
 *
 *   1. `normalizeExternalUrl` — parse/validate/canonicalize before storing.
 *      Stricter than the site-wide `isSafeExternalUrl`: https only. Every
 *      target these sections link to (MEGA, Telegram, Drive, GitHub, official
 *      AI vendor sites) serves https, so allowing http would only ever
 *      downgrade a user's connection.
 *
 *   2. `detectSourceType` — decide the platform badge from the *hostname*,
 *      never from the title or the admin's say-so. A row must not be able to
 *      claim "MEGA" while pointing somewhere else; that badge is exactly the
 *      signal a user leans on before clicking an outbound link.
 */

import { hasEmbeddedCredentials } from "@/lib/safe-url";

/**
 * Where a resource lives. Hostname-derived and therefore trustworthy — see
 * `detectSourceType`. Deliberately separate from `ResourceCategory` (what the
 * resource *is*), which is an editorial judgement only a human can make.
 */
export const RESOURCE_SOURCE_TYPES = [
  "MEGA",
  "TELEGRAM",
  "GOOGLE_DRIVE",
  "GITHUB",
  "DROPBOX",
  "ONEDRIVE",
  "YOUTUBE",
  "ARCHIVE_ORG",
  "WEBSITE",
] as const;

export type ResourceSourceTypeValue = (typeof RESOURCE_SOURCE_TYPES)[number];

/**
 * Exact hostnames (or registrable-domain suffixes) per platform.
 *
 * Suffix matching is anchored on a leading dot plus an exact-equality check,
 * so `notmega.nz` and `mega.nz.evil.example` both fall through to WEBSITE
 * rather than borrowing MEGA's badge. Substring matching would not be safe
 * here and is deliberately avoided.
 */
const SOURCE_DOMAINS: ReadonlyArray<readonly [ResourceSourceTypeValue, readonly string[]]> = [
  ["MEGA", ["mega.nz", "mega.io", "mega.co.nz"]],
  ["TELEGRAM", ["t.me", "telegram.me", "telegram.org", "telegram.dog"]],
  ["GOOGLE_DRIVE", ["drive.google.com", "docs.google.com"]],
  ["GITHUB", ["github.com", "github.io", "gist.github.com", "raw.githubusercontent.com"]],
  ["DROPBOX", ["dropbox.com"]],
  ["ONEDRIVE", ["onedrive.live.com", "1drv.ms", "sharepoint.com"]],
  ["YOUTUBE", ["youtube.com", "youtu.be"]],
  ["ARCHIVE_ORG", ["archive.org"]],
];

/** True when `hostname` is exactly `domain` or a subdomain of it. */
function hostMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

/**
 * Classify a URL by hostname alone. Returns "WEBSITE" for anything not
 * positively recognized — an honest "we don't know" rather than a guess.
 * Callers must treat a bad/unparseable URL as WEBSITE too; validation
 * rejects those separately.
 */
export function detectSourceType(url: string): ResourceSourceTypeValue {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "WEBSITE";
  }
  for (const [type, domains] of SOURCE_DOMAINS) {
    if (domains.some((d) => hostMatches(host, d))) return type;
  }
  return "WEBSITE";
}

/** Bare hostname for display ("mega.nz"), or null when unparseable. */
export function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

export const EXTERNAL_URL_MESSAGE =
  "Must be an https:// URL (no embedded credentials)";

/**
 * Validate and canonicalize an admin-entered external URL.
 *
 * Returns the normalized URL, or null if it must not be stored. Rejects:
 * anything that isn't https (so javascript:, data:, file:, ftp:, gopher:,
 * blob:, tg: and bare/malformed strings are all out), embedded credentials
 * (`https://apple.com@evil.example`), and hosts that are empty or obviously
 * non-public.
 *
 * Canonicalizing through the WHATWG URL parser also drops the tab/CR/LF
 * characters that parser strips, so a stored value can never carry a line
 * break into any header or attribute downstream.
 */
export function normalizeExternalUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.length > 2000) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") return null;
  if (hasEmbeddedCredentials(raw)) return null;

  const host = url.hostname.toLowerCase();
  if (!host || !host.includes(".")) return null; // no bare hosts / intranet names
  if (host === "localhost" || host.endsWith(".localhost")) return null;

  url.hostname = host;
  url.protocol = "https:";

  const normalized = url.toString();
  return normalized.length <= 2000 ? normalized : null;
}

/** Schema-friendly predicate wrapping `normalizeExternalUrl`. */
export function isStorableExternalUrl(value: string): boolean {
  return normalizeExternalUrl(value) !== null;
}
