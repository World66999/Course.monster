import { access, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { resolveUploadPath, uploadDir } from "@/lib/upload-path";
import { originalNameFor, parseVariantName, variantNamesFor, type VariantRequest } from "@/lib/image-variants";

/**
 * Writes the generated copies of an uploaded image (see image-variants.ts for
 * the naming rules). Node-only: it loads the native `sharp` module, so import
 * it lazily from anything that should stay light.
 *
 * Quality settings: AVIF at 55 looks the same as the WebP originals (quality
 * 80-82) at roughly 60% of the bytes. Effort 2: measured on this server, a
 * 1920px banner takes ~0.9 s against ~7.6 s at effort 4 for 8% more bytes.
 */
const AVIF = { quality: 55, effort: 2 } as const;
const WEBP = { quality: 80 } as const;
const JPEG = { quality: 80, mozjpeg: true } as const;

const exists = (p: string) => access(p).then(() => true, () => false);

async function findOriginal(base: string): Promise<string | null> {
  const abs = resolveUploadPath(originalNameFor(base));
  return abs && (await exists(abs)) ? abs : null;
}

async function render(originalAbs: string, v: VariantRequest): Promise<Buffer> {
  let img = sharp(originalAbs, { limitInputPixels: 40_000_000 });
  if (v.width) img = img.resize({ width: v.width, withoutEnlargement: true });
  switch (v.format) {
    case "avif":
      return img.avif(AVIF).toBuffer();
    case "webp":
      return img.webp(WEBP).toBuffer();
    case "png":
      return img.png({ compressionLevel: 9 }).toBuffer();
    case "jpg":
      // JPEG has no transparency; flatten onto white rather than black.
      return img.flatten({ background: "#ffffff" }).jpeg(JPEG).toBuffer();
  }
}

/** One encode at a time: AVIF is CPU-heavy and this shares a box with the site. */
let queue: Promise<unknown> = Promise.resolve();
const inFlight = new Map<string, Promise<string | null>>();

/**
 * Makes sure the generated file `fileName` exists and returns its absolute
 * path. Null when the name is not a variant this site generates or its
 * original is gone. Safe to call concurrently for the same name.
 */
export function ensureVariant(fileName: string): Promise<string | null> {
  const running = inFlight.get(fileName);
  if (running) return running;
  const job = (async () => {
    const v = parseVariantName(fileName);
    const abs = v && resolveUploadPath(fileName);
    if (!v || !abs) return null;
    if (await exists(abs)) return abs;
    const original = await findOriginal(v.base);
    if (!original) return null;
    const work = queue.then(async () => {
      if (await exists(abs)) return;
      const output = await render(original, v);
      // Write beside the target and rename: readers never see half a file.
      const tmp = `${abs}.${randomBytes(4).toString("hex")}.tmp`;
      await writeFile(tmp, output);
      await rename(tmp, abs);
    });
    queue = work.catch(() => {});
    await work;
    return abs;
  })().finally(() => inFlight.delete(fileName));
  inFlight.set(fileName, job);
  return job;
}

/** Generates every copy of one stored original. Returns how many were written. */
export async function generateVariants(originalFileName: string): Promise<number> {
  let written = 0;
  for (const name of variantNamesFor(originalFileName)) {
    const abs = resolveUploadPath(name);
    if (!abs || (await exists(abs))) continue;
    if (await ensureVariant(name)) written++;
  }
  return written;
}

/** Best-effort removal of the copies that belong to a deleted original. */
export async function deleteVariants(originalFileName: string): Promise<void> {
  for (const name of variantNamesFor(originalFileName)) {
    const abs = resolveUploadPath(name);
    if (!abs) continue;
    await unlink(abs).catch(() => {});
  }
}

/** Generates the missing copies for everything in the upload folder. */
export async function generateAllVariants(log: (line: string) => void = () => {}): Promise<{ originals: number; written: number }> {
  const files = await readdir(uploadDir());
  let originals = 0;
  let written = 0;
  for (const name of files) {
    // Empty for anything that is not a stored original (copies, other kinds).
    if (variantNamesFor(name).length === 0) continue;
    originals++;
    const n = await generateVariants(name);
    if (n > 0) log(`${name}: ${n} file(s)`);
    written += n;
  }
  return { originals, written };
}
