import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";

/**
 * vplink.in shortener client.
 *
 * - The API key lives only in server env (VPLINK_API_KEY); this module is
 *   marked `server-only` so it can never be bundled for the client.
 * - Generated links are cached in the `short_links` table keyed by
 *   (courseId, sha256(destination)), so each destination is shortened once.
 * - Requests are retried with backoff and time out; on total failure we fall
 *   back to the raw destination so downloads keep working.
 */

const REQUEST_TIMEOUT_MS = 8_000;
const RETRY_DELAYS_MS = [300, 900];

function hashDestination(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Parse the shortener response, tolerating JSON and plain-text bodies. */
function extractShortUrl(body: string): string | null {
  const trimmed = body.trim();
  try {
    const json = JSON.parse(trimmed) as Record<string, unknown>;
    if (typeof json.status === "string" && json.status.toLowerCase() === "error") {
      return null;
    }
    for (const key of ["shortenedUrl", "shortened_url", "short", "url", "shorturl"]) {
      const v = json[key];
      if (typeof v === "string" && isValidHttpUrl(v)) return v;
    }
    return null;
  } catch {
    return isValidHttpUrl(trimmed) ? trimmed : null;
  }
}

async function callShortenerApi(destination: string, alias?: string): Promise<string | null> {
  const apiKey = process.env.VPLINK_API_KEY;
  const apiBase = process.env.VPLINK_API_BASE ?? "https://vplink.in/api";
  if (!apiKey) return null;

  const params = new URLSearchParams({ api: apiKey, url: destination });
  if (alias) params.set("alias", alias);
  const endpoint = `${apiBase}?${params.toString()}`;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(endpoint, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
      const body = await res.text();
      if (res.ok) {
        const shortUrl = extractShortUrl(body);
        if (shortUrl) return shortUrl;
        console.error(`[shortener] unexpected response (attempt ${attempt + 1}):`, body.slice(0, 300));
        // An alias conflict is not transient — retry once without the alias.
        if (alias) return callShortenerApi(destination);
      } else {
        console.error(`[shortener] HTTP ${res.status} (attempt ${attempt + 1})`);
      }
    } catch (err) {
      console.error(`[shortener] request failed (attempt ${attempt + 1}):`, err instanceof Error ? err.message : err);
    }
    if (attempt < RETRY_DELAYS_MS.length) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
  return null;
}

/**
 * Return the short link for a course's destination, creating and caching it
 * on first use. Falls back to the destination itself when the shortener is
 * unconfigured or unavailable.
 */
export async function getShortLink(course: {
  id: string;
  slug: string;
  downloadUrl: string;
}): Promise<{ url: string; shortened: boolean }> {
  const destination = course.downloadUrl;
  if (!isValidHttpUrl(destination)) {
    throw new Error(`Course ${course.id} has an invalid download URL`);
  }

  const destinationHash = hashDestination(destination);
  const cached = await db.shortLink.findUnique({
    where: { courseId_destinationHash: { courseId: course.id, destinationHash } },
  });
  if (cached) return { url: cached.shortUrl, shortened: true };

  if (!process.env.VPLINK_API_KEY) {
    console.warn("[shortener] VPLINK_API_KEY not set — redirecting directly to destination");
    return { url: destination, shortened: false };
  }

  const alias = course.slug.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 30) || undefined;
  const shortUrl = await callShortenerApi(destination, alias);
  if (!shortUrl) {
    console.error(`[shortener] all attempts failed for course ${course.id}; falling back to destination`);
    return { url: destination, shortened: false };
  }

  await db.shortLink.upsert({
    where: { courseId_destinationHash: { courseId: course.id, destinationHash } },
    create: { courseId: course.id, destinationHash, shortUrl },
    update: { shortUrl },
  });
  console.info(`[shortener] created short link for course ${course.slug}`);
  return { url: shortUrl, shortened: true };
}

/** Drop cached short links for a course (used when its download URL changes). */
export async function invalidateShortLinks(courseId: string): Promise<void> {
  await db.shortLink.deleteMany({ where: { courseId } });
}
