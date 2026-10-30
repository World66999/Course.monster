import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  listRequestComments,
  listRequestCommentReplies,
  attachRequestCommentReactions,
  toRequestCommentDTO,
  canViewRequestComments,
} from "@/lib/course-requests";
import { listRequestCommentsQuerySchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp, hashIp } from "@/lib/ip";

export async function GET(request: NextRequest) {
  const ip = await getClientIp();
  const rl = checkRateLimit(`api-request-comments:${hashIp(ip)}`, { limit: 120, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = listRequestCommentsQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const { requestId, parentId, cursor } = parsed.data;
  const session = await auth();
  const userId = session?.user?.id ?? null;

  if (parentId) {
    const parent = await db.requestComment.findUnique({ where: { id: parentId }, select: { requestId: true } });
    if (!parent || !(await canViewRequestComments(parent.requestId, userId))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { items, nextCursor } = await listRequestCommentReplies(parentId, cursor ?? null);
    const withReactions = await attachRequestCommentReactions(items, userId);
    return NextResponse.json(
      { items: withReactions.map((c) => toRequestCommentDTO(c, userId)), nextCursor },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  if (!requestId) {
    return NextResponse.json({ error: "requestId or parentId is required" }, { status: 400 });
  }
  if (!(await canViewRequestComments(requestId, userId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { items, nextCursor } = await listRequestComments(requestId, { cursor });
  const withReactions = await attachRequestCommentReactions(items, userId);
  return NextResponse.json(
    { items: withReactions.map((c) => toRequestCommentDTO(c, userId)), nextCursor },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
