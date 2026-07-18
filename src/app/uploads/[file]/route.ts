import { NextRequest, NextResponse } from "next/server";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import path from "node:path";
import { resolveUploadPath } from "@/lib/upload-path";

const CONTENT_TYPES: Record<string, string> = {
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
 * directly (see deploy/nginx.conf) and this route is the fallback.
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

  try {
    const info = await stat(abs);
    if (!info.isFile()) throw new Error("not a file");
    const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream;
    return new NextResponse(stream, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(info.size),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
