import { NextRequest, NextResponse } from "next/server";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { resolveUploadPath } from "@/lib/uploads";

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

  try {
    const info = await stat(abs);
    if (!info.isFile()) throw new Error("not a file");
    const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream;
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(info.size),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
