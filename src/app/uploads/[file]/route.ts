import { NextRequest, NextResponse } from "next/server";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { resolveUploadPath } from "@/lib/upload-path";

const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
};

/**
 * Serves admin-uploaded images from UPLOAD_DIR with immutable caching.
 * Filenames are random and content-addressed-ish (never reused), so
 * aggressive caching is safe. In production Nginx can serve these
 * directly (see deploy/nginx.conf) and this route is the fallback. It is
 * also where a missing AVIF or smaller-size copy gets generated on first use.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  const abs = resolveUploadPath(file);
  if (!abs) return new NextResponse("Not found", { status: 404 });

  const contentType = CONTENT_TYPES[path.extname(file).toLowerCase()];
  if (!contentType) return new NextResponse("Not found", { status: 404 });

  const serve = async (target: string) => {
    const info = await stat(target);
    if (!info.isFile()) throw new Error("not a file");
    const stream = Readable.toWeb(createReadStream(target)) as ReadableStream;
    return new NextResponse(stream, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(info.size),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  };

  try {
    return await serve(abs);
  } catch {
    // Not on disk. If it is a generated copy of an existing upload (an AVIF or
    // a smaller size, see lib/image-variants.ts), make it now. Loaded lazily so
    // plain file serving never pulls in the native image library.
    try {
      const { ensureVariant } = await import("@/lib/image-variant-writer");
      const made = await ensureVariant(file);
      if (made) return await serve(made);
    } catch (err) {
      console.error("[uploads] could not generate", file, err);
    }
    return new NextResponse("Not found", { status: 404 });
  }
}
