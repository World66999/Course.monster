import "server-only";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { uploadDir, resolveUploadPath } from "@/lib/upload-path";

export { resolveUploadPath, uploadDir } from "@/lib/upload-path";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"]);

const VARIANTS = {
  thumbnail: { width: 800, quality: 82 },
  banner: { width: 1920, quality: 80 },
  logo: { width: 512, quality: 90 },
  meta: { width: 1200, quality: 82 },
  avatar: { width: 256, quality: 85 },
  chatImage: { width: 1280, quality: 82 },
  chatImageThumb: { width: 320, quality: 75 },
  requestImage: { width: 1000, quality: 82 },
  requestImageThumb: { width: 400, quality: 78 },
  channelLogo: { width: 512, quality: 90 },
  appIcon: { width: 512, quality: 90 },
  appScreenshot: { width: 1280, quality: 80 },
  resourceThumbnail: { width: 800, quality: 82 },
} as const;

export type UploadKind = keyof typeof VARIANTS;

/** Rejects obviously-too-small source images before they're ever resized/stored. */
const MIN_DIMENSIONS: Record<UploadKind, { width: number; height: number }> = {
  thumbnail: { width: 200, height: 113 },
  banner: { width: 800, height: 300 },
  logo: { width: 64, height: 64 },
  meta: { width: 400, height: 210 },
  avatar: { width: 64, height: 64 },
  chatImage: { width: 100, height: 100 },
  chatImageThumb: { width: 100, height: 100 },
  requestImage: { width: 200, height: 113 },
  requestImageThumb: { width: 100, height: 100 },
  channelLogo: { width: 128, height: 128 },
  appIcon: { width: 128, height: 128 },
  appScreenshot: { width: 300, height: 300 },
  resourceThumbnail: { width: 200, height: 113 },
};

export async function saveImageUpload(file: File, kind: UploadKind): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new UploadError("Unsupported image type. Use JPEG, PNG, WebP, AVIF or GIF.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError("Image is too large (max 8 MB).");
  }

  const input = Buffer.from(await file.arrayBuffer());

  let pipeline: ReturnType<typeof sharp>;
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    pipeline = sharp(input, { limitInputPixels: 40_000_000 });
    metadata = await pipeline.metadata();
  } catch {
    throw new UploadError("File could not be processed as an image.");
  }

  const min = MIN_DIMENSIONS[kind];
  if (!metadata.width || !metadata.height || metadata.width < min.width || metadata.height < min.height) {
    throw new UploadError(`Image is too small (minimum ${min.width}×${min.height}px).`);
  }

  const { width, quality } = VARIANTS[kind];
  let output: Buffer;
  try {
    output = await pipeline
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

/**
 * Best-effort delete of a previously uploaded file, given the public URL
 * path we handed back from saveImageUpload() (e.g. "/uploads/banner-...webp").
 * Only ever touches our own uploads directory (via resolveUploadPath's
 * traversal guard); a pasted external URL is silently ignored. Never
 * throws — cleanup must not block or fail the operation that triggered it.
 */
export async function deleteUpload(urlPath: string): Promise<void> {
  const prefix = "/uploads/";
  if (!urlPath.startsWith(prefix)) return;
  const abs = resolveUploadPath(urlPath.slice(prefix.length));
  if (!abs) return;
  try {
    await unlink(abs);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("[uploads] failed to delete orphaned file:", err);
    }
  }
}

export class UploadError extends Error {}
