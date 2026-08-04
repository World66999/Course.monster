/**
 * YouTube URL parsing/embedding helpers, shared by Coding Channels and the
 * Free Learning Hub. Every embed URL is built here from a validated,
 * extracted ID — nothing in this app ever accepts or renders raw iframe
 * HTML from a user/admin-supplied string.
 */

export type YoutubeUrlKind = "video" | "playlist" | "channel";

export interface ParsedYoutubeUrl {
  type: YoutubeUrlKind;
  id: string;
}

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

function isYoutubeHost(hostname: string): boolean {
  return YOUTUBE_HOSTS.has(hostname.toLowerCase());
}

/**
 * Parses a YouTube URL into a { type, id } pair, or null if it isn't a
 * recognizable YouTube video/playlist/channel URL. Never throws.
 */
export function parseYouTubeUrl(input: string): ParsedYoutubeUrl | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  // Credentials in the authority are a classic way to make a URL *look* like it
  // points at an allowed host ("https://youtube.com@evil.example/"): the real
  // host there is evil.example. URL parsing already resolves that correctly, but
  // reject them outright so no such URL is ever stored or echoed back either.
  if (url.username || url.password) return null;
  if (!isYoutubeHost(url.hostname)) return null;

  const path = url.pathname.replace(/\/+$/, "");

  if (url.hostname.toLowerCase() === "youtu.be") {
    const id = path.slice(1).split("/")[0];
    return id ? { type: "video", id } : null;
  }

  const playlistId = url.searchParams.get("list");
  const videoId = url.searchParams.get("v");

  if (path === "/watch" && videoId) return { type: "video", id: videoId };
  if (path === "/playlist" && playlistId) return { type: "playlist", id: playlistId };

  const embedMatch = /^\/embed\/([a-zA-Z0-9_-]+)$/.exec(path);
  if (embedMatch) return { type: "video", id: embedMatch[1] };

  const shortsMatch = /^\/shorts\/([a-zA-Z0-9_-]+)$/.exec(path);
  if (shortsMatch) return { type: "video", id: shortsMatch[1] };

  // A /watch or /embed URL can still carry a playlist id alongside a video id.
  if (videoId && playlistId) return { type: "video", id: videoId };

  const channelMatch = /^\/channel\/([a-zA-Z0-9_-]+)$/.exec(path);
  if (channelMatch) return { type: "channel", id: channelMatch[1] };

  const handleMatch = /^\/@([a-zA-Z0-9_.-]+)$/.exec(path);
  if (handleMatch) return { type: "channel", id: `@${handleMatch[1]}` };

  const legacyMatch = /^\/(?:c|user)\/([a-zA-Z0-9_-]+)$/.exec(path);
  if (legacyMatch) return { type: "channel", id: legacyMatch[1] };

  return null;
}

export function isYoutubeUrl(input: string): boolean {
  return parseYouTubeUrl(input) !== null;
}

/** Static thumbnail — safe to use directly in a plain <img>, no iframe involved. */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

/**
 * Privacy-enhanced embed URL (youtube-nocookie.com). `rel=0`/`modestbranding=1`
 * are cosmetic only — YouTube still sets cookies once the video actually
 * plays, which is why callers must only mount this behind an explicit click
 * (see YoutubeEmbed component), never eagerly on page load.
 */
export function youtubeEmbedUrl(videoId: string, opts?: { playlistId?: string }): string {
  const params = new URLSearchParams({ rel: "0", modestbranding: "1", autoplay: "1" });
  if (opts?.playlistId) params.set("list", opts.playlistId);
  // A playlist opened without a specific starting video uses the documented
  // `videoseries` path. An empty id (`/embed/?list=…`) happens to play today,
  // but it isn't part of YouTube's contract, so don't depend on it.
  const path = videoId ? encodeURIComponent(videoId) : "videoseries";
  return `https://www.youtube-nocookie.com/embed/${path}?${params.toString()}`;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

export function youtubePlaylistUrl(playlistId: string): string {
  return `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
}

export interface YoutubeOEmbedResult {
  title: string;
  authorName: string;
  /** Canonical channel URL YouTube reports for the video's uploader, e.g. https://www.youtube.com/@Fireship. */
  authorUrl: string;
  thumbnailUrl: string;
}

/**
 * Why a lookup didn't produce metadata. Callers turn these into specific,
 * truthful messages instead of one catch-all "couldn't fetch".
 */
export type YoutubeMetaFailure =
  | "invalid-url"
  | "channel-unsupported"
  | "not-found"
  | "upstream-error"
  | "timeout"
  | "network";

export type YoutubeOEmbedOutcome =
  | { ok: true; data: YoutubeOEmbedResult }
  | { ok: false; reason: YoutubeMetaFailure };

/**
 * Rewrites any recognised video/playlist URL into the canonical form YouTube's
 * oEmbed endpoint actually accepts.
 *
 * This matters: oEmbed returns 404 for `/embed/<id>` URLs even though they are
 * perfectly valid YouTube links, and query noise (`&list=`, `&t=`, tracking
 * params) is best dropped. Verified against the live endpoint — watch/youtu.be/
 * shorts/m.youtube all resolve, `/embed/` only resolves once normalised.
 *
 * Returns null for channel URLs: oEmbed has no channel support at all (it 404s
 * for both `/@handle` and `/channel/UC…`), so there is nothing to normalise to.
 */
export function canonicalYoutubeUrlForOEmbed(input: string): string | null {
  const parsed = parseYouTubeUrl(input);
  if (!parsed) return null;
  if (parsed.type === "video") return youtubeWatchUrl(parsed.id);
  if (parsed.type === "playlist") return youtubePlaylistUrl(parsed.id);
  return null; // channel
}

const OEMBED_TIMEOUT_MS = 6000;
const OEMBED_MAX_BYTES = 64 * 1024;
const OEMBED_MAX_REDIRECTS = 2;

/**
 * Server-only. Fetches YouTube's public oEmbed endpoint (no API key needed).
 *
 * SSRF posture: the only host ever contacted is YouTube's own oEmbed endpoint.
 * The admin-supplied URL is validated + canonicalised first and then passed as a
 * *query parameter* for YouTube to resolve — it is never fetched directly. The
 * redirect chain is followed manually so every hop is re-checked against the
 * YouTube host allowlist, the response is size-capped, and the whole thing is
 * bounded by a timeout.
 */
export async function fetchYoutubeOEmbed(rawUrl: string): Promise<YoutubeOEmbedOutcome> {
  const parsed = parseYouTubeUrl(rawUrl);
  if (!parsed) return { ok: false, reason: "invalid-url" };
  if (parsed.type === "channel") return { ok: false, reason: "channel-unsupported" };

  const canonical = canonicalYoutubeUrlForOEmbed(rawUrl);
  if (!canonical) return { ok: false, reason: "invalid-url" };

  let target = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonical)}&format=json`;

  try {
    let res: Response | null = null;
    for (let hop = 0; hop <= OEMBED_MAX_REDIRECTS; hop++) {
      res = await fetch(target, {
        signal: AbortSignal.timeout(OEMBED_TIMEOUT_MS),
        redirect: "manual",
        headers: { accept: "application/json" },
      });
      if (res.status < 300 || res.status >= 400) break;

      const location = res.headers.get("location");
      if (!location) break;
      const next = new URL(location, target);
      // Never follow a redirect off YouTube — that is the one place this could
      // be turned into a request against an attacker-chosen host.
      if (next.protocol !== "https:" || !isYoutubeHost(next.hostname) || next.username || next.password) {
        console.warn("[youtube] refusing off-allowlist oEmbed redirect to", next.hostname);
        return { ok: false, reason: "upstream-error" };
      }
      target = next.toString();
      res = null;
    }

    if (!res) return { ok: false, reason: "upstream-error" };
    // YouTube answers 400 for an id it can't resolve and 401/403/404 for
    // private/removed/restricted items — all "no public details", not a fault
    // on our side (verified against the live endpoint: unknown id -> 400).
    if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) {
      return { ok: false, reason: "not-found" };
    }
    if (!res.ok) {
      console.warn("[youtube] oEmbed upstream returned", res.status);
      return { ok: false, reason: "upstream-error" };
    }

    const body = await res.text();
    if (body.length > OEMBED_MAX_BYTES) {
      console.warn("[youtube] oEmbed response exceeded size cap");
      return { ok: false, reason: "upstream-error" };
    }

    let data: { title?: unknown; author_name?: unknown; author_url?: unknown; thumbnail_url?: unknown };
    try {
      data = JSON.parse(body);
    } catch {
      console.warn("[youtube] oEmbed returned non-JSON body");
      return { ok: false, reason: "upstream-error" };
    }
    if (typeof data.title !== "string") return { ok: false, reason: "upstream-error" };

    // Only trust an author_url that is itself a YouTube channel URL.
    let authorUrl = "";
    if (typeof data.author_url === "string") {
      const a = parseYouTubeUrl(data.author_url);
      if (a?.type === "channel") authorUrl = data.author_url;
    }

    return {
      ok: true,
      data: {
        title: data.title,
        authorName: typeof data.author_name === "string" ? data.author_name : "",
        authorUrl,
        thumbnailUrl: typeof data.thumbnail_url === "string" ? data.thumbnail_url : "",
      },
    };
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    // Logged because the previous silent `return null` made this failure
    // undiagnosable from production logs.
    console.error("[youtube] oEmbed lookup failed:", err);
    return { ok: false, reason: timedOut ? "timeout" : "network" };
  }
}
