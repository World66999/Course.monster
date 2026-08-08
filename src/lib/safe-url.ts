/**
 * Scheme/authority checks for URLs that are later rendered as an `href` or
 * `src`, or used as a redirect target.
 *
 * Zod's `.url()` only checks that a string *parses* as a URL — `javascript:`,
 * `data:` and `vbscript:` all pass it. Several admin-entered fields (course
 * downloadUrl/telegramUrl, site settings telegram/social links) were validated
 * with bare `.url()` and rendered straight into an `href`, so a stored
 * `javascript:` URI would have executed in every visitor's browser. Being
 * admin-only limits who can set it; it does not limit who it fires for.
 */

/** http/https only — rejects javascript:, data:, vbscript:, file:, ftp:, tg:, … */
export function isHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

/**
 * Credentials in the authority let a URL *look* like it points somewhere
 * trustworthy — `https://www.microsoft.com@evil.example/` is a request to
 * evil.example. Nothing here needs them, so they are rejected outright rather
 * than stored and shown to users. (`parseYouTubeUrl` already does the same.)
 */
export function hasEmbeddedCredentials(value: string): boolean {
  try {
    const url = new URL(value);
    return Boolean(url.username || url.password);
  } catch {
    return false;
  }
}

/** The check applied to every externally-linked URL field. */
export function isSafeExternalUrl(value: string): boolean {
  return isHttpUrl(value) && !hasEmbeddedCredentials(value);
}

export const SAFE_URL_MESSAGE = "Must be an http:// or https:// URL without embedded credentials";
