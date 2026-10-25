import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { chatMessageSelect } from "@/lib/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
 const searchParams = request.nextUrl.searchParams;
 const after = searchParams.get("after");
 const since = searchParams.get("since");

 const encoder = new TextEncoder();

 const stream = new ReadableStream({
 async start(controller) {
 let lastId = after;
 let lastServerTime = since ? new Date(since) : new Date();
 let backoffMs = 2000;
 let lastAnchorId: string | null = null;
 let lastAnchorCreatedAt: Date | null = null;

 const send = (data: object) => {
 try {
 controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
 } catch {
 // Stream closed — happens on disconnect, not an error.
 }
 };

 const fetchNew = async () => {
 try {
 const where: Record<string, unknown> = { status: "VISIBLE", linkPending: false };

 if (lastId && lastId !== lastAnchorId) {
 // Re-fetch anchor only when the cursor has actually changed (new messages
 // arrived since the last tick). Reusing the cached (createdAt, id) pair
 // avoids one findUnique per poll per connected client — the only thing
 // that changes between ticks for the live-feed branch.
 const anchor = await db.chatMessage.findUnique({
 where: { id: lastId },
 select: { createdAt: true, id: true },
 });
 if (anchor) {
 lastAnchorCreatedAt = anchor.createdAt;
 lastAnchorId = anchor.id;
 }
 }

 if (lastAnchorCreatedAt && lastAnchorId) {
 where.OR = [
 { createdAt: { gt: lastAnchorCreatedAt } },
 { createdAt: lastAnchorCreatedAt, id: { gt: lastAnchorId } },
 ];
 } else if (lastServerTime) {
 where.createdAt = { gt: lastServerTime };
 }

 const items = await db.chatMessage.findMany({
 where,
 select: chatMessageSelect,
 orderBy: [{ createdAt: "asc" }, { id: "asc" }],
 take: 50,
 });

 if (items.length > 0) {
 lastId = items[items.length - 1].id;
 lastAnchorId = lastId;
 lastAnchorCreatedAt = items[items.length - 1].createdAt;
 lastServerTime = new Date();
 send({ type: "messages", items });
 }

 // Removed-message check: only every third tick to reduce DB load.
 // The SSE interval is already 2-30s, so a 6-90s detection window is
 // acceptable for moderation status changes.
 if (Math.random() < 0.33) {
 const removed = await db.chatMessage.findMany({
 where: {
 updatedAt: { gt: lastServerTime },
 OR: [{ status: { not: "VISIBLE" } }, { linkPending: true }],
 },
 select: { id: true },
 take: 200,
 });
 if (removed.length > 0) {
 send({ type: "removed", ids: removed.map((r) => r.id) });
 }
 }

 backoffMs = 2000;
 } catch (error) {
 console.error("[SSE] fetch error:", error);
 backoffMs = Math.min(backoffMs * 2, 30000);
 }
 };

 // Initial fetch immediately
 await fetchNew();

 // Poll at backoff interval
 const interval = setInterval(async () => {
 await fetchNew();
 }, backoffMs);

 // Keep-alive ping every 15s
 const ping = setInterval(() => {
 try {
 controller.enqueue(encoder.encode(": ping\n\n"));
 } catch {
 // Stream closed
 }
 }, 15000);

 request.signal.addEventListener("abort", () => {
 clearInterval(interval);
 clearInterval(ping);
 try {
 controller.close();
 } catch { /* already closed */ }
 });
 },
 });

 return new Response(stream, {
 headers: {
 "Content-Type": "text/event-stream",
 "Cache-Control": "no-cache, no-store",
 Connection: "keep-alive",
 "X-Accel-Buffering": "no",
 },
 });
}
