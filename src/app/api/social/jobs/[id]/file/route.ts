import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { fetchRemoteFile } from "@/lib/social-download";
import { contentDisposition } from "@/lib/content-disposition";

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

  // Creating a job is rate limited; re-fetching a finished one was not, so a
  // single account could pull the same multi-hundred-megabyte artefact in a
  // loop and spend the server's egress on it. Generous enough for the real
  // cases this needs to allow — a resumed transfer, a retried tap, a second
  // device — and nowhere near enough to be worth abusing.
  const rl = checkRateLimit(`social:file:${userId}`, { limit: 30, windowMs: 10 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many download requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const { id } = await params;
  const job = await db.socialDownloadJob.findFirst({ where: { id, userId } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.status !== "COMPLETED") return NextResponse.json({ error: "Not ready" }, { status: 409 });

  const upstream = await fetchRemoteFile(job.remoteId, userId);
  if (!upstream || !upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "That download has expired. Please try again." }, { status: 410 });
  }

  const headers = new Headers({
    "Content-Type": "application/octet-stream",
    "Content-Disposition": contentDisposition(job.fileName),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  const len = upstream.headers.get("content-length");
  if (len) headers.set("Content-Length", len);

  return new NextResponse(upstream.body, { status: 200, headers });
}
