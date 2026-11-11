"use server";

import { revalidatePath } from "next/cache";
import { z } from "@/lib/zod";
import { db } from "@/lib/db";
import { requireUserSafe } from "@/server/auth-helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { cleanText } from "@/lib/sanitize";
import { isActiveUntil } from "@/lib/premium";
import { notifyAdmins } from "@/lib/telegram/notify";
import { esc } from "@/lib/telegram/render";
import { SUPPORT_LIMITS } from "@/lib/support-limits";

/**
 * Premium Purchase Support — the member side. Every query here is scoped by
 * the caller's own user id; a ticket id from the client is only ever used
 * together with `userId: me`, so guessing another id finds nothing.
 */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };


function overLimit(userId: string): boolean {
  return !checkRateLimit(`support:${userId}`, {
    limit: SUPPORT_LIMITS.messagesPerWindow,
    windowMs: SUPPORT_LIMITS.windowMs,
  }).ok;
}

const createSchema = z.object({
  subject: z.string().max(400),
  topic: z.enum(["OTHER_PAYMENT_METHOD", "PAYMENT_PROBLEM", "OTHER"]),
  body: z.string().max(10_000),
});

async function isPremiumNow(userId: string): Promise<boolean> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { premiumUntil: true } });
  return isActiveUntil(u?.premiumUntil);
}

export async function createTicketAction(input: unknown): Promise<Result<{ id: string }>> {
  const auth = await requireUserSafe();
  if (!auth.ok) return { ok: false, error: auth.error };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please fill in every field." };
  const subject = cleanText(parsed.data.subject, SUPPORT_LIMITS.subjectMax).replace(/\n/g, " ");
  const body = cleanText(parsed.data.body, SUPPORT_LIMITS.bodyMax);
  if (subject.length < 3) return { ok: false, error: "Please add a short subject." };
  if (body.length < SUPPORT_LIMITS.bodyMin) return { ok: false, error: "Please describe the problem." };

  const open = await db.supportTicket.count({ where: { userId: auth.user.id, status: { not: "CLOSED" } } });
  if (open >= SUPPORT_LIMITS.maxOpenTickets) {
    return { ok: false, error: `You already have ${open} open tickets. Please reply in one of those.` };
  }
  if (overLimit(auth.user.id)) return { ok: false, error: "You're sending messages too quickly. Please wait a few minutes." };

  const priority = await isPremiumNow(auth.user.id);
  const ticket = await db.supportTicket.create({
    data: {
      userId: auth.user.id,
      subject,
      topic: parsed.data.topic,
      priority,
      messages: { create: { authorId: auth.user.id, fromStaff: false, body } },
    },
  });
  await notifyAdmins(
    `${priority ? "⭐ <b>PRIORITY</b> " : ""}🎫 New support ticket: <b>${esc(subject)}</b>\n${esc(body.slice(0, 300))}`
  );
  return { ok: true, id: ticket.id };
}

const replySchema = z.object({ ticketId: z.string().cuid(), body: z.string().max(10_000) });

export async function replyTicketAction(input: unknown): Promise<Result> {
  const auth = await requireUserSafe();
  if (!auth.ok) return { ok: false, error: auth.error };
  const parsed = replySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid message." };
  const body = cleanText(parsed.data.body, SUPPORT_LIMITS.bodyMax);
  if (body.length < 1) return { ok: false, error: "Message can't be empty." };

  // Ownership is part of the lookup, not a check after it.
  const ticket = await db.supportTicket.findFirst({
    where: { id: parsed.data.ticketId, userId: auth.user.id },
    select: { id: true, status: true, subject: true },
  });
  if (!ticket) return { ok: false, error: "Ticket not found." };
  if (ticket.status === "CLOSED") return { ok: false, error: "This ticket is closed. Please open a new one." };
  if (overLimit(auth.user.id)) return { ok: false, error: "You're sending messages too quickly. Please wait a few minutes." };

  const priority = await isPremiumNow(auth.user.id);
  await db.$transaction([
    db.supportMessage.create({ data: { ticketId: ticket.id, authorId: auth.user.id, fromStaff: false, body } }),
    db.supportTicket.update({
      where: { id: ticket.id },
      data: { status: "OPEN", lastMessageAt: new Date(), priority },
    }),
  ]);
  await notifyAdmins(`${priority ? "⭐ " : ""}💬 New reply on ticket <b>${esc(ticket.subject)}</b>`);
  revalidatePath(`/premium/support/${ticket.id}`);
  return { ok: true };
}

export async function closeTicketAction(ticketId: unknown): Promise<Result> {
  const auth = await requireUserSafe();
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!z.string().cuid().safeParse(ticketId).success) return { ok: false, error: "Invalid request." };
  const { count } = await db.supportTicket.updateMany({
    where: { id: ticketId as string, userId: auth.user.id },
    data: { status: "CLOSED" },
  });
  if (count !== 1) return { ok: false, error: "Ticket not found." };
  revalidatePath(`/premium/support/${ticketId as string}`);
  return { ok: true };
}
