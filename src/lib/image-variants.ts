/**
 * Naming rules for the smaller and newer-format copies of an uploaded image.
 *
 * An upload is stored once, as `/uploads/<kind>-<id>.webp` (see uploads.ts).
 * Next to it live generated copies whose names are derived from it, so no
 * database change is needed and any page can work the names out on its own:
 *
 *   thumbnail-abc.webp        the stored original (800px)
 *   thumbnail-abc.avif        same size, AVIF
 *   thumbnail-abc-400.avif    400px, AVIF        (and -400.webp)
 *   thumbnail-abc.jpg         same size, JPEG    (last-resort fallback; PNG
 *                             for kinds that can be transparent)
 *
 * This file is pure string logic and safe to import anywhere. The files
 * themselves are written by image-variant-writer.ts: at upload time, by
 * `scripts/generate-image-variants.ts` for older uploads, and on first request
 * by the /uploads route if one is ever missing.
 */

/** Widths per upload kind, smallest first. The last one is the stored size. */
export const VARIANT_WIDTHS: Record<string, readonly number[]> = {
  thumbnail: [400, 640, 800],
  resourceThumbnail: [400, 640, 800],
  banner: [768, 1280, 1920],
  appScreenshot: [640, 1280],
  appIcon: [128, 256, 512],
  channelLogo: [128, 256, 512],
  logo: [128, 256, 512],
};

/** Kinds that can be transparent: their fallback stays PNG, never JPEG. */
const ALPHA_KINDS = new Set(["appIcon", "channelLogo", "logo"]);

/** Only uploads written by the upload pipeline (always WebP) have copies. */
const UPLOAD_RE = /^\/uploads\/([a-zA-Z0-9._-]+)\.webp$/;

export type VariantFormat = "avif" | "webp" | "jpg" | "png";

export interface VariantRequest {
  /** File name of the stored original candidates, without extension. */
  base: string;
  kind: string;
  /** Target width, or null for "same size as the original". */
  width: number | null;
  format: VariantFormat;
}

/** Upload kind from a file's base name (`thumbnail-abc` → `thumbnail`). */
export function kindOf(base: string): string {
  return base.split("-")[0] ?? "";
}

/**
 * Reads a requested file name as a variant, or returns null when it is not
 * one this site generates. Only widths from the fixed list above are
 * accepted, so the number of files per original is bounded.
 */
export function parseVariantName(fileName: string): VariantRequest | null {
  const m = /^([a-zA-Z0-9._-]+?)(?:-(\d{2,4}))?\.(avif|webp|jpg|png)$/.exec(fileName);
  if (!m) return null;
  const [, base, w, format] = m as unknown as [string, string, string | undefined, VariantFormat];
  const kind = kindOf(base);
  const widths = VARIANT_WIDTHS[kind];
  if (!widths) return null;
  const max = widths[widths.length - 1]!;
  let width: number | null = null;
  if (w !== undefined) {
    width = Number(w);
    if (!widths.includes(width) || width === max) return null;
    // Small copies exist in the two modern formats only.
    if (format !== "avif" && format !== "webp") return null;
  }
  // The full-size WebP is the stored original itself, never a copy.
  if (format === "webp" && width === null) return null;
  if (format === "jpg" && ALPHA_KINDS.has(kind)) return null;
  if (format === "png" && !ALPHA_KINDS.has(kind)) return null;
  return { base, kind, width, format };
}

/** File name of the stored original a copy is made from. */
export function originalNameFor(base: string): string {
  return `${base}.webp`;
}

/** Every generated file name that belongs to one stored original. */
export function variantNamesFor(originalFileName: string): string[] {
  const m = /^([a-zA-Z0-9._-]+)\.webp$/.exec(originalFileName);
  if (!m) return [];
  const base = m[1]!;
  const kind = kindOf(base);
  const widths = VARIANT_WIDTHS[kind];
  // A sized WebP copy (`…-400.webp`) is not an original.
  if (!widths || parseVariantName(originalFileName)) return [];
  const names: string[] = [];
  for (const w of widths.slice(0, -1)) names.push(`${base}-${w}.avif`, `${base}-${w}.webp`);
  names.push(`${base}.avif`, ALPHA_KINDS.has(kind) ? `${base}.png` : `${base}.jpg`);
  return names;
}

export interface ImageSources {
  avifSrcSet: string;
  webpSrcSet: string;
  /** JPEG or PNG: for the rare browser with neither AVIF nor WebP. */
  fallback: string;
}

/**
 * `<picture>` sources for an uploaded image, or null when `src` is not one of
 * ours (an external URL, a kind without variants): render a plain `<img>`.
 */
export function imageSources(src: string | null | undefined): ImageSources | null {
  if (!src) return null;
  const m = UPLOAD_RE.exec(src);
  if (!m) return null;
  const base = m[1]!;
  const kind = kindOf(base);
  const widths = VARIANT_WIDTHS[kind];
  if (!widths) return null;
  const max = widths[widths.length - 1]!;
  const smaller = widths.slice(0, -1);
  const set = (format: "avif" | "webp") =>
    [...smaller.map((w) => `/uploads/${base}-${w}.${format} ${w}w`), `/uploads/${base}.${format} ${max}w`].join(", ");
  return {
    avifSrcSet: set("avif"),
    webpSrcSet: set("webp"),
    fallback: `/uploads/${base}.${ALPHA_KINDS.has(kind) ? "png" : "jpg"}`,
  };
}
