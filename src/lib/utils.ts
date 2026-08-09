import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function absoluteUrl(path = ""): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Serialize a value for safe embedding inside a `<script>` tag.
 * `JSON.stringify` alone is unsafe here: a string containing `</script>`
 * (or the JS line terminators U+2028/U+2029) would break out of the tag.
 * Escaping `<`, `>`, `&` and those separators as unicode escapes keeps the
 * JSON valid while making tag breakout impossible.
 */
export function safeJsonLd(value: unknown): string {
  const escapes: Record<string, string> = {
    "<": "\\u003c",
    ">": "\\u003e",
    "&": "\\u0026",
    "\u2028": "\\u2028",
    "\u2029": "\\u2029",
  };
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (c) => escapes[c]);
}

/** Deterministic gradient pair from a string, used for image placeholders. */
/**
 * Some hues (yellows/limes especially) render much lighter than others at
 * the same HSL lightness, since perceived brightness isn't linear across
 * hue — white text on those fails WCAG contrast. This picks readable text
 * color per-gradient instead of assuming white always works.
 */
function isLightHsl(h: number, s: number, l: number): boolean {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const hNorm = h / 360;
  const sNorm = s / 100;
  const lNorm = l / 100;
  const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
  const p = 2 * lNorm - q;
  const r = hue2rgb(p, q, hNorm + 1 / 3) * 255;
  const g = hue2rgb(p, q, hNorm) * 255;
  const b = hue2rgb(p, q, hNorm - 1 / 3) * 255;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 140;
}

export function gradientFromString(input: string): { from: string; to: string; light: boolean } {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  const hue2 = (hue + 40) % 360;
  return {
    from: `hsl(${hue} 70% 45%)`,
    to: `hsl(${hue2} 80% 35%)`,
    light: isLightHsl(hue, 70, 45),
  };
}
