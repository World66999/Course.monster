"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth-helpers";
import { logAudit } from "@/lib/audit";
import { adminPath } from "@/lib/admin-path";
import { queueBroadcast, runBroadcast } from "@/lib/telegram/broadcast";
import { deleteWebhook, getMe, setMyCommands, setWebhook } from "@/lib/telegram/api";
import { adminIds } from "@/lib/telegram/config";
import { hasBotToken, siteUrl, webhookPathSegment, webhookSecret } from "@/lib/telegram/config";
import type { ActionResult } from "@/server/actions/courses";

/**
 * Telegram bot administration.
 *
 * Every action is gated by the same `requireAdmin()` the rest of the panel
 * uses — there is no second authentication system for the bot, and an ordinary
 * website account can never reach any of this.
 */

const idSchema = z.string().cuid();

function revalidate() {
  revalidatePath(adminPath("telegram"), "layout");
}

/** The catalog is never edited here — only bot-side state. */
export async function setTelegramUserBlockedAction(
  userId: unknown,
  blocked: unknown
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsedId = idSchema.safeParse(userId);
  const parsedBlocked = z.boolean().safeParse(blocked);
  if (!parsedId.success || !parsedBlocked.success) return { ok: false, error: "Invalid request" };

  const existing = await db.telegramUser.findUnique({
    where: { id: parsedId.data },
    select: { id: true, telegramId: true },
  });
  if (!existing) return { ok: false, error: "Bot user not found" };

  await db.telegramUser.update({
    where: { id: existing.id },
    data: { blocked: parsedBlocked.data },
  });
  await logAudit({
    userId: admin.id,
    action: parsedBlocked.data ? "telegramUser.block" : "telegramUser.unblock",
    entity: "telegramUser",
    entityId: existing.id,
    meta: { telegramId: existing.telegramId },
  });
  revalidate();
  return { ok: true };
}

const broadcastSchema = z.object({
  body: z.string().trim().min(1, "Message is required").max(3500, "Message is too long"),
});

export async function createBroadcastAction(input: unknown): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = broadcastSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  if (!hasBotToken()) return { ok: false, error: "The bot token is not configured on the server." };

  const broadcast = await db.broadcast.create({
    data: { body: parsed.data.body, createdById: admin.id },
  });
  const total = await queueBroadcast(broadcast.id);

  await logAudit({
    userId: admin.id,
    action: "telegramBroadcast.create",
    entity: "broadcast",
    entityId: broadcast.id,
    meta: { recipients: total },
  });

  // Start immediately; the cron pump continues it if it outlives this request.
  void runBroadcast(broadcast.id).catch((err) =>
    console.error("[telegram] initial broadcast run failed:", err)
  );

  revalidate();
  return { ok: true, id: broadcast.id };
}

async function setBroadcastStatus(
  broadcastId: unknown,
  status: "PAUSED" | "CANCELLED" | "QUEUED",
  action: string
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = idSchema.safeParse(broadcastId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  const existing = await db.broadcast.findUnique({
    where: { id: parsed.data },
    select: { id: true, status: true },
  });
  if (!existing) return { ok: false, error: "Broadcast not found" };
  if (existing.status === "COMPLETED") return { ok: false, error: "That broadcast already finished." };

  await db.broadcast.update({ where: { id: existing.id }, data: { status } });
  await logAudit({ userId: admin.id, action, entity: "broadcast", entityId: existing.id });

  if (status === "QUEUED") {
    void runBroadcast(existing.id).catch((err) =>
      console.error("[telegram] resumed broadcast run failed:", err)
    );
  }
  revalidate();
  return { ok: true };
}

// Every export in a "use server" module must itself be an async function.
export async function pauseBroadcastAction(id: unknown): Promise<ActionResult> {
  return setBroadcastStatus(id, "PAUSED", "telegramBroadcast.pause");
}
export async function cancelBroadcastAction(id: unknown): Promise<ActionResult> {
  return setBroadcastStatus(id, "CANCELLED", "telegramBroadcast.cancel");
}
export async function resumeBroadcastAction(id: unknown): Promise<ActionResult> {
  return setBroadcastStatus(id, "QUEUED", "telegramBroadcast.resume");
}

/**
 * Registers the webhook with Telegram. The URL is built server-side from the
 * configured secret path segment — it is never accepted from the browser, so
 * this cannot be pointed at an arbitrary host.
 */
export async function registerWebhookAction(): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!hasBotToken()) return { ok: false, error: "The bot token is not configured on the server." };

  let url: string;
  let secret: string;
  try {
    url = `${siteUrl()}/api/telegram/webhook/${webhookPathSegment()}`;
    secret = webhookSecret();
  } catch {
    return { ok: false, error: "The webhook path/secret is not configured on the server." };
  }

  const res = await setWebhook(url, secret);
  if (!res.ok) return { ok: false, error: `Telegram rejected the webhook: ${res.description}` };

  const publicCommands = [
    { command: "start", description: "Main menu" },
    { command: "courses", description: "Browse the course catalog" },
    { command: "search", description: "Search for a course" },
    { command: "upcoming", description: "See what's coming next" },
    { command: "website", description: "Open courses.monster" },
    { command: "donate", description: "Support the project with Telegram Stars" },
    { command: "paysupport", description: "Help with a payment" },
    { command: "help", description: "How to use this bot" },
  ];
  await setMyCommands(publicCommands);

  // Telegram resolves a user's command menu from the most specific scope that
  // is set, so a per-chat list keeps /admin out of everyone else's menu. The
  // handler checks the id independently — this only controls visibility.
  for (const id of adminIds()) {
    const res = await setMyCommands(
      [...publicCommands, { command: "admin", description: "Bot status (admins only)" }],
      { type: "chat", chat_id: id }
    );
    if (!res.ok) console.warn(`[telegram] could not publish admin commands for ${id}: ${res.description}`);
  }

  await logAudit({ userId: admin.id, action: "telegramBot.setWebhook", entity: "telegramBot" });
  revalidate();
  return { ok: true };
}

export async function removeWebhookAction(): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!hasBotToken()) return { ok: false, error: "The bot token is not configured on the server." };
  const res = await deleteWebhook();
  if (!res.ok) return { ok: false, error: `Telegram rejected the request: ${res.description}` };
  await logAudit({ userId: admin.id, action: "telegramBot.deleteWebhook", entity: "telegramBot" });
  revalidate();
  return { ok: true };
}

export async function checkBotAction(): Promise<ActionResult> {
  await requireAdmin();
  if (!hasBotToken()) return { ok: false, error: "The bot token is not configured on the server." };
  const res = await getMe();
  if (!res.ok) return { ok: false, error: `Telegram rejected the request: ${res.description}` };
  revalidate();
  return { ok: true, id: res.result.username };
}
