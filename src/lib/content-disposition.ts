/**
 * Build a Content-Disposition value that is always a legal HTTP header.
 *
 * HTTP header values are ByteStrings — every character must fit in a single
 * byte. Platform titles do not: a Facebook video titled in Bengali produced a
 * filename full of U+09xx codepoints, and interpolating that into the header
 * made `new Headers()` throw ("character ... greater than 255"), so the download
 * route returned 500 and the browser download never started. Only videos with
 * ASCII titles worked, which is exactly what was reported as "Facebook doesn't
 * download" while YouTube did.
 *
 * RFC 6266 is the fix: a plain ASCII `filename` every client understands, plus
 * RFC 5987 `filename*` carrying the real UTF-8 name percent-encoded. Modern
 * browsers, Android Chrome included, prefer `filename*` and show the original
 * title; older ones still get a sensible ASCII name.
 */
export function contentDisposition(rawName: string | null | undefined): string {
  // Quotes, backslashes and CR/LF are removed first: they are the characters
  // that could otherwise terminate the quoted string or split the header.
  const name = (rawName ?? "download").replace(/[\r\n"\\]/g, "").slice(0, 150) || "download";

  // ASCII fallback, built from base and extension separately so a title that is
  // entirely non-ASCII still yields "download.mp4" rather than a bare "mp4" the
  // operating system cannot open. Semicolons go too: harmless inside the quoted
  // string, but there is no reason to hand a parser something ambiguous.
  const ext = /\.[A-Za-z0-9]{1,5}$/.exec(name)?.[0] ?? "";
  const base = ext ? name.slice(0, -ext.length) : name;
  const asciiBase = base
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[;]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.\s]+/, "");
  const ascii = (asciiBase || "download") + ext;

  // encodeURIComponent leaves a few characters RFC 5987 does not allow bare.
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
