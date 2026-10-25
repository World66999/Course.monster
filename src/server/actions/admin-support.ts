"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth-helpers";
import { logAudit } from "@/lib/audit";
import { cleanText } from "@/lib/sanitize";
import { notifyUser } from "@/lib/telegram/notify";
import { siteUrl } from "@/lib/telegram/config";
import { esc } from "@/lib/telegram/render";
import { adminPath } from "@/lib/admin-path";
import type { ActionResult } from "@/server/actions/courses";

const replySchema = z.object({ ticketId: z.string().cuid(), body: z.string().min(1).max(10_000) });

export async function adminReplyTicketAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Write a reply first." };
  const body = cleanText(parsed.data.body, 4000);
  if (!body) return { ok: false, error: "Write a reply first." };
  const ticket = await db.supportTicket.findUnique({
    where: { id: parsed.data.ticketId },
    select: { id: true, userId: true, subject: true },
  });
  if (!ticket) return { ok: false, error: "Ticket not found" };

  await db.$transaction([
    db.supportMessage.create({ data: { ticketId: ticket.id, authorId: admin.id, fromStaff: true, body } }),
    db.supportTicket.update({ where: { id: ticket.id }, data: { status: "ANSWERED", lastMessageAt: new Date() } }),
  ]);
  await logAudit({ userId: admin.id, action: "support.reply", entity: "supportTicket", entityId: ticket.id });
  await notifyUser(
    ticket.userId,
    `💬 <b>Support replied</b> to “${esc(ticket.subject)}”\n\n${esc(body.slice(0, 600))}${body.length > 600 ? "…" : ""}\n\n` +
      `<a href="${siteUrl()}/premium/support/${ticket.id}">Open the ticket</a>`
  );
  revalidatePath(adminPath("support"), "layout");
  return { ok: true };
}

const statusSchema = z.object({ ticketId: z.string().cuid(), status: z.enum(["OPEN", "ANSWERED", "CLOSED"]) });

export async function adminSetTicketStatusAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const { count } = await db.supportTicket.updateMany({
    where: { id: parsed.data.ticketId },
    data: { status: parsed.data.status },
  });
  if (count !== 1) return { ok: false, error: "Ticket not found" };
  await logAudit({
    userId: admin.id,
    action: "support.status",
    entity: "supportTicket",
    entityId: parsed.data.ticketId,
    meta: { status: parsed.data.status },
  });
  revalidatePath(adminPath("support"), "layout");
  return { ok: true };
}
