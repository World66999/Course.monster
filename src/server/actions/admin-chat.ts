"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth-helpers";
import { logAudit } from "@/lib/audit";
import type { ActionResult } from "@/server/actions/courses";

const idSchema = z.string().cuid();
const statusSchema = z.enum(["VISIBLE", "HIDDEN", "DELETED"]);

const ACTION_VERB: Record<z.infer<typeof statusSchema>, string> = {
  VISIBLE: "restore",
  HIDDEN: "hide",
  DELETED: "delete",
};

/** Self-contained — deliberately not folded into moderation.ts's comment/review
 * `moderateContentAction`, since chat has no course/rating semantics to touch. */
export async function moderateChatMessageAction(id: unknown, status: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsedId = idSchema.safeParse(id);
  const parsedStatus = statusSchema.safeParse(status);
  if (!parsedId.success || !parsedStatus.success) return { ok: false, error: "Invalid request" };

  try {
    await db.chatMessage.update({ where: { id: parsedId.data }, data: { status: parsedStatus.data } });
  } catch (err) {
    console.error("[admin-chat] status update failed:", err);
    return { ok: false, error: "Message not found" };
  }

  await logAudit({
    userId: admin.id,
    action: `chat.message.${ACTION_VERB[parsedStatus.data]}`,
    entity: "chatMessage",
    entityId: parsedId.data,
  });
  revalidatePath("/chat");
  return { ok: true };
}

export async function approveChatLinkAction(id: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid message" };

  const message = await db.chatMessage
    .update({ where: { id: parsed.data }, data: { linkPending: false } })
    .catch(() => null);
  if (!message) return { ok: false, error: "Message not found" };

  await logAudit({ userId: admin.id, action: "chat.link.approve", entity: "chatMessage", entityId: parsed.data });
  revalidatePath("/chat");
  return { ok: true };
}

export async function rejectChatLinkAction(id: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid message" };

  // Soft: cleared from the pending queue and hidden, never hard-deleted —
  // consistent with the rest of this app's moderation model.
  const message = await db.chatMessage
    .update({ where: { id: parsed.data }, data: { linkPending: false, status: "HIDDEN" } })
    .catch(() => null);
  if (!message) return { ok: false, error: "Message not found" };

  await logAudit({ userId: admin.id, action: "chat.link.reject", entity: "chatMessage", entityId: parsed.data });
  revalidatePath("/chat");
  return { ok: true };
}

async function setChatBanned(adminId: string, userId: string, banned: boolean): Promise<ActionResult> {
  const target = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) return { ok: false, error: "User not found" };
  if (target.role === "ADMIN" || target.role === "EDITOR") {
    return { ok: false, error: "Staff accounts can't be banned from chat." };
  }

  await db.user.update({ where: { id: userId }, data: { chatBanned: banned } });
  await logAudit({
    userId: adminId,
    action: banned ? "chat.user.ban" : "chat.user.unban",
    entity: "user",
    entityId: userId,
  });
  revalidatePath("/chat");
  return { ok: true };
}

export async function banUserFromChatAction(userId: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = idSchema.safeParse(userId);
  if (!parsed.success) return { ok: false, error: "Invalid user" };
  return setChatBanned(admin.id, parsed.data, true);
}

export async function unbanUserFromChatAction(userId: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = idSchema.safeParse(userId);
  if (!parsed.success) return { ok: false, error: "Invalid user" };
  return setChatBanned(admin.id, parsed.data, false);
}

export async function muteUserAction(userId: unknown, minutes: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsedId = idSchema.safeParse(userId);
  const parsedMinutes = z.coerce.number().int().min(1).max(10_080).safeParse(minutes); // up to 7 days
  if (!parsedId.success || !parsedMinutes.success) return { ok: false, error: "Invalid request" };

  const target = await db.user.findUnique({ where: { id: parsedId.data }, select: { role: true } });
  if (!target) return { ok: false, error: "User not found" };
  if (target.role === "ADMIN" || target.role === "EDITOR") {
    return { ok: false, error: "Staff accounts can't be muted." };
  }

  const until = new Date(Date.now() + parsedMinutes.data * 60_000);
  await db.user.update({ where: { id: parsedId.data }, data: { chatMutedUntil: until } });
  await logAudit({
    userId: admin.id,
    action: "chat.user.mute",
    entity: "user",
    entityId: parsedId.data,
    meta: { minutes: parsedMinutes.data },
  });
  revalidatePath("/chat");
  return { ok: true };
}

export async function unmuteUserAction(userId: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = idSchema.safeParse(userId);
  if (!parsed.success) return { ok: false, error: "Invalid user" };

  await db.user.update({ where: { id: parsed.data }, data: { chatMutedUntil: null } }).catch(() => null);
  await logAudit({ userId: admin.id, action: "chat.user.unmute", entity: "user", entityId: parsed.data });
  revalidatePath("/chat");
  return { ok: true };
}
