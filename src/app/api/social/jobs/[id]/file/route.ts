import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { fetchRemoteFile } from "@/lib/social-download";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Streams the finished artefact to the browser.
 *
 * The internal service is never reachable from the browser; this route is the
 * only way out, and it re-checks ownership before proxying a single byte. The
 * filename is re-derived from our own row so nothing user-supplied reaches the
 * Content-Disposition header.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const job = await db.socialDownloadJob.findFirst({ where: { id, userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.status !== "COMPLETED") return NextResponse.json({ error: "Not ready" }, { status: 409 });

  const upstream = await fetchRemoteFile(job.remoteId, userId);
  if (!upstream || !upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "That download has expired. Please try again." }, { status: 410 });
  }

  // Quote and strip: a filename can contain a quote, and an unescaped one would
  // let the header be split.
  const safeName = (job.fileName ?? "download").replace(/["\\\r\n]/g, "").slice(0, 120) || "download";
  const headers = new Headers({
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="${safeName}"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);

  return new NextResponse(upstream.body, { status: 200, headers });
}
