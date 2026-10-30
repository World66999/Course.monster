"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireUserSafe } from "@/server/auth-helpers";
import { getClientIp, hashIp } from "@/lib/ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { checkContent } from "@/lib/profanity";
import { checkPostingRate, normalizeText } from "@/lib/spam-guards";
import { assertCanPostChat, containsUrl, isValidChatEmoji } from "@/lib/chat";
import { isStaff } from "@/lib/roles";
import {
  chatMessageFormSchema,
  chatReactionSchema,
  chatDisplayNameFormSchema,
} from "@/lib/validation";
import { getSiteSettings } from "@/lib/settings";
import { logAudit } from "@/lib/audit";
import type { ActionResult } from "@/server/actions/courses";

const idSchema = z.string().cuid();

export async function createChatMessageAction(input: unknown): Promise<ActionResult> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;

  const guard = await assertCanPostChat(user.id);
  if (!guard.ok) return guard;

  const parsed = chatMessageFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { parentId, imageUrl } = parsed.data;
  // Both come from the same upload call (see /api/upload/chat-image) — fall
  // back to the full image if the thumb is somehow missing so rendering
  // never breaks.
  const imageThumbUrl = parsed.data.imageThumbUrl ?? imageUrl;
  const body = parsed.data.body.trim();

  if (!body && !imageUrl) {
    return { ok: false, error: "Write a message or attach an image." };
  }

  const settings = await getSiteSettings();
  if (!settings.chat.enabled) return { ok: false, error: "Chat is currently disabled." };
  if (body && body.length < settings.chat.minLength) {
    return { ok: false, error: `Message must be at least ${settings.chat.minLength} characters.` };
  }
  if (body.length > settings.chat.maxLength) {
    return { ok: false, error: `Message must be under ${settings.chat.maxLength} characters.` };
  }

  // Every non-staff user must choose a chat display name before posting —
  // satisfies "users choose their own username" without touching the
  // account-level signup username (staff always show as "Admin").
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { chatDisplayName: true, role: true },
  });
  if (!isStaff(dbUser?.role) && !dbUser?.chatDisplayName) {
    return { ok: false, error: "Choose a chat display name before posting." };
  }

  const rate = checkPostingRate(user.id, "chat", settings.chat);
  if (!rate.ok) return rate;

  if (parentId) {
    const parent = await db.chatMessage.findUnique({
      where: { id: parentId },
      select: { parentId: true, status: true },
    });
    if (!parent || parent.status === "DELETED") return { ok: false, error: "Message not found." };
    if (parent.parentId) return { ok: false, error: "Replies can't be nested further." };
  }

  // Duplicate-identical-message prevention within the configured window.
  const dupWindowStart = new Date(Date.now() - settings.chat.duplicateWindowMinutes * 60_000);
  const recent = await db.chatMessage.findFirst({
    where: { userId: user.id, createdAt: { gt: dupWindowStart } },
    orderBy: { createdAt: "desc" },
    select: { body: true },
  });
  if (recent && body && normalizeText(recent.body) === normalizeText(body)) {
    return { ok: false, error: "You've already posted this." };
  }

  const ip = await getClientIp();
  const ipHash = hashIp(ip);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;

  const linkPending = containsUrl(body);
  const check = settings.chat.profanityFilterEnabled
    ? checkContent(body)
    : { flagged: false, reasons: [] as string[] };

  const message = await db.chatMessage.create({
    data: {
      userId: user.id,
      parentId: parentId ?? null,
      body,
      imageUrl: imageUrl ?? null,
      imageThumbUrl: imageUrl ? imageThumbUrl : null,
      status: check.flagged ? "HIDDEN" : "VISIBLE",
      linkPending,
      ipHash,
      userAgent,
    },
  });

  if (check.flagged || linkPending) {
    await logAudit({
      userId: user.id,
      action: linkPending ? "chat.link_pending" : "chat.autoflag",
      entity: "chatMessage",
      entityId: message.id,
      meta: check.flagged ? { reasons: check.reasons } : undefined,
    });
  }

  return { ok: true, id: message.id };
}

export interface ChatMessageEditResult {
  id: string;
  body: string;
  editedAt: string;
  status: "VISIBLE" | "HIDDEN" | "DELETED";
}

/**
 * Returns the confirmed body/status so the client can reconcile its
 * optimistic edit — mirrors editCommentAction/editReviewAction: a
 * profanity-flagged edit comes back HIDDEN and must not leave a
 * still-visible optimistic body on screen.
 */
export async function editChatMessageAction(
  messageId: unknown,
  body: unknown
): Promise<ActionResult & { message?: ChatMessageEditResult }> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;

  const guard = await assertCanPostChat(user.id);
  if (!guard.ok) return guard;

  const parsedId = idSchema.safeParse(messageId);
  if (!parsedId.success) return { ok: false, error: "Invalid message" };

  const settings = await getSiteSettings();
  const parsedBody = z
    .string()
    .trim()
    .max(settings.chat.maxLength, `Message must be under ${settings.chat.maxLength} characters.`)
    .safeParse(body);
  if (!parsedBody.success) {
    return { ok: false, error: parsedBody.error.issues[0]?.message ?? "Invalid message" };
  }

  const existing = await db.chatMessage.findUnique({ where: { id: parsedId.data } });
  if (!existing || existing.status === "DELETED") return { ok: false, error: "Message not found." };
  if (existing.userId !== user.id) return { ok: false, error: "You can only edit your own messages." };

  const trimmed = parsedBody.data;
  if (!trimmed && !existing.imageUrl) return { ok: false, error: "Message can't be empty." };

  const linkPending = containsUrl(trimmed);
  const check = settings.chat.profanityFilterEnabled
    ? checkContent(trimmed)
    : { flagged: false, reasons: [] as string[] };

  const updated = await db.chatMessage.update({
    where: { id: parsedId.data },
    data: {
      body: trimmed,
      editedAt: new Date(),
      linkPending,
      status: check.flagged ? "HIDDEN" : existing.status === "HIDDEN" ? "HIDDEN" : "VISIBLE",
    },
    select: { id: true, body: true, editedAt: true, status: true },
  });

  return {
    ok: true,
    id: updated.id,
    message: { id: updated.id, body: updated.body, editedAt: updated.editedAt!.toISOString(), status: updated.status },
  };
}

export async function deleteChatMessageAction(messageId: unknown): Promise<ActionResult> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;
  const parsed = idSchema.safeParse(messageId);
  if (!parsed.success) return { ok: false, error: "Invalid message" };

  const existing = await db.chatMessage.findUnique({ where: { id: parsed.data }, select: { userId: true } });
  if (!existing) return { ok: false, error: "Message not found." };
  if (existing.userId !== user.id) return { ok: false, error: "You can only delete your own messages." };

  await db.chatMessage.update({ where: { id: parsed.data }, data: { status: "DELETED" } });
  return { ok: true };
}

export async function toggleChatReactionAction(
  input: unknown
): Promise<ActionResult & { reacted?: boolean }> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;

  const parsed = chatReactionSchema.safeParse(input);
  if (!parsed.success || !isValidChatEmoji(parsed.data.emoji)) {
    return { ok: false, error: "Invalid reaction" };
  }

  const guard = await assertCanPostChat(user.id);
  if (!guard.ok) return guard;

  const message = await db.chatMessage.findUnique({
    where: { id: parsed.data.messageId },
    select: { id: true, status: true },
  });
  if (!message || message.status !== "VISIBLE") return { ok: false, error: "Message not found." };

  const existing = await db.chatReaction.findUnique({
    where: {
      messageId_userId_emoji: { messageId: parsed.data.messageId, userId: user.id, emoji: parsed.data.emoji },
    },
  });

  if (existing) {
    await db.chatReaction.delete({ where: { id: existing.id } });
    return { ok: true, reacted: false };
  }

  // A generous but real cap — stops one user from reacting with every
  // allowed emoji on a single message as a spam vector.
  const countForUser = await db.chatReaction.count({
    where: { messageId: parsed.data.messageId, userId: user.id },
  });
  if (countForUser >= 8) return { ok: false, error: "Too many reactions on this message." };

  await db.chatReaction.create({
    data: { messageId: parsed.data.messageId, userId: user.id, emoji: parsed.data.emoji },
  });
  return { ok: true, reacted: true };
}

export async function setChatDisplayNameAction(input: unknown): Promise<ActionResult> {
  const auth = await requireUserSafe();
  if (!auth.ok) return auth;
  const user = auth.user;

  const parsed = chatDisplayNameFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name" };

  const rl = checkRateLimit(`chat-display-name:${user.id}`, { limit: 5, windowMs: 60 * 60_000 });
  if (!rl.ok) return { ok: false, error: "Too many changes. Please try again later." };

  try {
    await db.user.update({
      where: { id: user.id },
      data: { chatDisplayName: parsed.data.chatDisplayName },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "That name is already taken." };
    }
    throw err;
  }
  return { ok: true };
}
