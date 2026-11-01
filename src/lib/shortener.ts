import "server-only";
import { db } from "@/lib/db";
import {
  extractShortUrl,
  isValidHttpUrl,
  type ShortenerProvider,
} from "@/lib/shortener-core";

export { fallbackChain, providerForSlot, type ShortenerProvider } from "@/lib/shortener-core";

/**
 * URL shortener clients for the free unlock flow (see free-unlocks.ts).
 *
 * Every free unlock shortens a one-time *return URL* on this site — never the
 * course's download URL — so the visitor only reaches the course after the
 * shortener's steps send them back to /unlock/<token>, where the unlock is
 * verified and counted.
 *
 * API tokens live only in server env and this module is `server-only`. A
 * failed or slow shortener is logged and the caller moves on to the next one.
 */

const GPLINKS_TIMEOUT_MS = 10_000;
const LINKSHORTIFY_TIMEOUT_MS = 10_000;
const VPLINK_TIMEOUT_MS = 8_000;
const VPLINK_RETRY_DELAYS_MS = [500];

/** The API token a provider needs, or null when it is not configured. */
function tokenFor(provider: ShortenerProvider): string | null {
  const v =
    provider === "vplink"
      ? process.env.VPLINK_API_KEY
      : provider === "gplinks"
        ? process.env.GPLINKS_API_TOKEN
        : process.env.LINKSHORTIFY_API_TOKEN;
  return v && v.trim() ? v.trim() : null;
}

export function isProviderConfigured(provider: ShortenerProvider): boolean {
  return tokenFor(provider) !== null;
}

/** One GET to a "standard" shortener API (`?api=&url=`); null on any failure. */
async function callStandardApi(
  label: ShortenerProvider,
  endpoint: string,
  timeoutMs: number
): Promise<string | null> {
  const started = Date.now();
  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    const body = await res.text();
    if (!res.ok) {
      console.error(`[shortener:${label}] HTTP ${res.status} after ${Date.now() - started}ms`);
      return null;
    }
    const url = extractShortUrl(body);
    if (!url) console.error(`[shortener:${label}] unexpected response:`, body.slice(0, 200));
    return url;
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error(`[shortener:${label}] request failed after ${Date.now() - started}ms:`, msg);
    return null;
  }
}

async function shortenVplink(destination: string, token: string): Promise<string | null> {
  const apiBase = process.env.VPLINK_API_BASE ?? "https://vplink.in/api";
  const endpoint = `${apiBase}?${new URLSearchParams({ api: token, url: destination })}`;
  for (let attempt = 0; attempt <= VPLINK_RETRY_DELAYS_MS.length; attempt++) {
    const url = await callStandardApi("vplink", endpoint, VPLINK_TIMEOUT_MS);
    if (url) return url;
    if (attempt < VPLINK_RETRY_DELAYS_MS.length) {
      await new Promise((r) => setTimeout(r, VPLINK_RETRY_DELAYS_MS[attempt]));
    }
  }
  return null;
}

async function shortenGplinks(destination: string, token: string): Promise<string | null> {
  const apiBase = process.env.GPLINKS_API_BASE ?? "https://api.gplinks.com/api";
  const endpoint = `${apiBase}?${new URLSearchParams({ api: token, url: destination })}`;
  return callStandardApi("gplinks", endpoint, GPLINKS_TIMEOUT_MS);
}

/**
 * LinkShortify: the standard API first. If that does not answer with a short
 * URL, its documented Quick Link format is used as the visitor's link directly
 * — it needs no API call and shows the same steps.
 */
async function shortenLinkshortify(destination: string, token: string): Promise<string | null> {
  const query = new URLSearchParams({ api: token, url: destination });
  const apiBase = process.env.LINKSHORTIFY_API_BASE ?? "https://linkshortify.com/api";
  const viaApi = await callStandardApi("linkshortify", `${apiBase}?${query}`, LINKSHORTIFY_TIMEOUT_MS);
  if (viaApi) return viaApi;
  console.warn("[shortener:linkshortify] API failed — using the Quick Link format");
  return `https://linkshortify.com/st?${query}`;
}

/** Shortens `destination` with one provider. Null when unconfigured or failed. */
export async function shortenWith(provider: ShortenerProvider, destination: string): Promise<string | null> {
  if (!isValidHttpUrl(destination)) throw new Error("refusing to shorten a non-http(s) URL");
  const token = tokenFor(provider);
  if (!token) return null;
  switch (provider) {
    case "vplink":
      return shortenVplink(destination, token);
    case "gplinks":
      return shortenGplinks(destination, token);
    case "linkshortify":
      return shortenLinkshortify(destination, token);
  }
}

/** Drop cached short links for a course (used when its download URL changes). */
export async function invalidateShortLinks(courseId: string): Promise<void> {
  await db.shortLink.deleteMany({ where: { courseId } });
}
