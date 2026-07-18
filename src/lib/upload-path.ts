import path from "node:path";

/** Absolute path of the upload directory (also used by the sharp-based writer). */
export function uploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
}

/**
 * Resolve a stored upload filename to an absolute path, refusing traversal.
 * Pure path logic with no image-processing dependency, so the read/serve
 * route never transitively loads the native `sharp` module.
 */
export function resolveUploadPath(fileName: string): string | null {
  if (!/^[a-zA-Z0-9._-]+$/.test(fileName)) return null;
  const abs = path.join(uploadDir(), fileName);
  if (!abs.startsWith(uploadDir() + path.sep)) return null;
  return abs;
}
