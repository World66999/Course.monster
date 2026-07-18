import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

const VARIANTS = {
  thumbnail: { width: 800, quality: 82 },
  banner: { width: 1920, quality: 80 },
  logo: { width: 512, quality: 90 },
  meta: { width: 1200, quality: 82 },
} as const;

export type UploadKind = keyof typeof VARIANTS;

export function uploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
}

export async function saveImageUpload(file: File, kind: UploadKind): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new UploadError("Unsupported image type. Use JPEG, PNG, WebP, AVIF or GIF.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError("Image is too large (max 8 MB).");
  }

  const input = Buffer.from(await file.arrayBuffer());
  const { width, quality } = VARIANTS[kind];

  let output: Buffer;
  try {
    output = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate() // respect EXIF orientation
      .resize({ width, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
  } catch {
    throw new UploadError("File could not be processed as an image.");
  }

  const name = `${kind}-${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.webp`;
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), output);
  return `/uploads/${name}`;
}

export class UploadError extends Error {}

/** Resolve a stored upload filename to an absolute path, refusing traversal. */
export function resolveUploadPath(fileName: string): string | null {
  if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) return null;
  const abs = path.join(uploadDir(), fileName);
  if (!abs.startsWith(uploadDir() + path.sep)) return null;
  return abs;
}
