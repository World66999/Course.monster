"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth-helpers";
import { logAudit } from "@/lib/audit";
import { parseTags } from "@/lib/validation";
import { premiumCategorySchema, premiumChatSchema, premiumResourceSchema } from "@/lib/premium-content";
import type { ActionResult } from "@/server/actions/courses";

const idSchema = z.string().cuid();
const reorderSchema = z.object({ id: idSchema, order: z.number().int().min(0).max(100_000) });

function revalidatePremium() {
  revalidatePath("/premium-resources");
  revalidatePath("/premium-chats");
}

function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? "Invalid input";
}

// ---------------------------------------------------------------- categories

export async function savePremiumCategoryAction(id: string | null, input: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = premiumCategorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const data = { ...parsed.data, description: parsed.data.description || null, icon: parsed.data.icon || null };
  try {
    const row = id
      ? await db.premiumCategory.update({ where: { id: idSchema.parse(id) }, data })
      : await db.premiumCategory.create({ data });
    await logAudit({ userId: user.id, action: id ? "premiumCategory.update" : "premiumCategory.create", entity: "premiumCategory", entityId: row.id });
    revalidatePremium();
    return { ok: true, id: row.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "That slug is already used by another category." };
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return { ok: false, error: "Category not found" };
    }
    console.error("[admin] savePremiumCategory failed:", err);
    return { ok: false, error: "Failed to save category." };
  }
}

export async function deletePremiumCategoryAction(id: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const count = await db.premiumResource.count({ where: { categoryId: parsed.data } });
  if (count > 0) return { ok: false, error: `Move or delete its ${count} resource(s) first.` };
  await db.premiumCategory.deleteMany({ where: { id: parsed.data } });
  await logAudit({ userId: user.id, action: "premiumCategory.delete", entity: "premiumCategory", entityId: parsed.data });
  revalidatePremium();
  return { ok: true };
}

export async function setPremiumCategoryOrderAction(input: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const { count } = await db.premiumCategory.updateMany({ where: { id: parsed.data.id }, data: { order: parsed.data.order } });
  if (count !== 1) return { ok: false, error: "Category not found" };
  await logAudit({ userId: user.id, action: "premiumCategory.reorder", entity: "premiumCategory", entityId: parsed.data.id });
  revalidatePremium();
  return { ok: true };
}

// ----------------------------------------------------------------- resources

export async function savePremiumResourceAction(id: string | null, input: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = premiumResourceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const v = parsed.data;
  const category = await db.premiumCategory.findUnique({ where: { id: v.categoryId }, select: { id: true } });
  if (!category) return { ok: false, error: "Pick a category" };
  const data = {
    categoryId: v.categoryId,
    title: v.title,
    summary: v.summary,
    content: v.content,
    url: v.url || null,
    tags: parseTags(v.tags),
    published: v.published,
    order: v.order,
  };
  try {
    let row;
    if (id) {
      row = await db.premiumResource.update({ where: { id: idSchema.parse(id) }, data });
    } else {
      const last = await db.premiumResource.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
      row = await db.premiumResource.create({ data: { ...data, order: v.order || (last?.order ?? 0) + 1 } });
    }
    await logAudit({ userId: user.id, action: id ? "premiumResource.update" : "premiumResource.create", entity: "premiumResource", entityId: row.id, meta: { title: row.title } });
    revalidatePremium();
    return { ok: true, id: row.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return { ok: false, error: "Resource not found" };
    }
    console.error("[admin] savePremiumResource failed:", err);
    return { ok: false, error: "Failed to save resource." };
  }
}

export async function deletePremiumResourceAction(id: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  await db.premiumResource.deleteMany({ where: { id: parsed.data } });
  await logAudit({ userId: user.id, action: "premiumResource.delete", entity: "premiumResource", entityId: parsed.data });
  revalidatePremium();
  return { ok: true };
}

export async function togglePremiumResourcePublishedAction(id: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const row = await db.premiumResource.findUnique({ where: { id: parsed.data }, select: { published: true } });
  if (!row) return { ok: false, error: "Resource not found" };
  await db.premiumResource.update({ where: { id: parsed.data }, data: { published: !row.published } });
  await logAudit({ userId: user.id, action: "premiumResource.toggle_published", entity: "premiumResource", entityId: parsed.data });
  revalidatePremium();
  return { ok: true };
}

export async function setPremiumResourceOrderAction(input: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const { count } = await db.premiumResource.updateMany({ where: { id: parsed.data.id }, data: { order: parsed.data.order } });
  if (count !== 1) return { ok: false, error: "Resource not found" };
  await logAudit({ userId: user.id, action: "premiumResource.reorder", entity: "premiumResource", entityId: parsed.data.id });
  revalidatePremium();
  return { ok: true };
}

// --------------------------------------------------------------------- chats

export async function savePremiumChatAction(id: string | null, input: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = premiumChatSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const v = parsed.data;
  const data = {
    title: v.title,
    description: v.description,
    category: v.category,
    kind: v.kind,
    telegramChatId: v.kind === "TELEGRAM_GROUP" ? v.telegramChatId : null,
    published: v.published,
    order: v.order,
  };
  try {
    const row = id
      ? await db.premiumChat.update({ where: { id: idSchema.parse(id) }, data })
      : await db.premiumChat.create({ data });
    await logAudit({ userId: user.id, action: id ? "premiumChat.update" : "premiumChat.create", entity: "premiumChat", entityId: row.id });
    revalidatePremium();
    return { ok: true, id: row.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return { ok: false, error: "Chat not found" };
    }
    console.error("[admin] savePremiumChat failed:", err);
    return { ok: false, error: "Failed to save chat." };
  }
}

export async function deletePremiumChatAction(id: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  await db.premiumChat.deleteMany({ where: { id: parsed.data } });
  await logAudit({ userId: user.id, action: "premiumChat.delete", entity: "premiumChat", entityId: parsed.data });
  revalidatePremium();
  return { ok: true };
}

export async function deletePremiumChatMessageAction(id: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const { count } = await db.premiumChatMessage.updateMany({
    where: { id: parsed.data, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (count !== 1) return { ok: false, error: "Message not found" };
  await logAudit({ userId: user.id, action: "premiumChat.message_delete", entity: "premiumChatMessage", entityId: parsed.data });
  return { ok: true };
}

const muteSchema = z.object({ userId: idSchema, minutes: z.number().int().min(0).max(60 * 24 * 30) });

/** minutes = 0 lifts a mute. */
export async function setPremiumChatMuteAction(input: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = muteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const until = parsed.data.minutes > 0 ? new Date(Date.now() + parsed.data.minutes * 60_000) : null;
  const { count } = await db.user.updateMany({
    where: { id: parsed.data.userId, role: "USER" },
    data: { premiumChatMutedUntil: until },
  });
  if (count !== 1) return { ok: false, error: "User not found (staff can't be muted)." };
  await logAudit({ userId: user.id, action: "premiumChat.mute", entity: "user", entityId: parsed.data.userId, meta: { minutes: parsed.data.minutes } });
  return { ok: true };
}

const banSchema = z.object({ userId: idSchema, banned: z.boolean() });

export async function setPremiumChatBanAction(input: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = banSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const { count } = await db.user.updateMany({
    where: { id: parsed.data.userId, role: "USER" },
    data: { premiumChatBanned: parsed.data.banned },
  });
  if (count !== 1) return { ok: false, error: "User not found (staff can't be banned)." };
  await logAudit({ userId: user.id, action: parsed.data.banned ? "premiumChat.ban" : "premiumChat.unban", entity: "user", entityId: parsed.data.userId });
  return { ok: true };
}
