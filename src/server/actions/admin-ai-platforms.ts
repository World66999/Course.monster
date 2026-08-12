"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth-helpers";
import { logAudit } from "@/lib/audit";
import { aiPlatformFormSchema, parseTags } from "@/lib/validation";
import { deleteUpload } from "@/lib/uploads";
import type { ActionResult } from "@/server/actions/courses";

const idSchema = z.string().cuid();
const idsSchema = z.array(idSchema).min(1).max(200);

function revalidateSite() {
  revalidatePath("/", "layout");
}

async function releaseLogo(oldPath: string | null, excludeId: string, keep: string | null): Promise<void> {
  if (!oldPath || !oldPath.startsWith("/uploads/")) return;
  if (keep === oldPath) return;
  const stillUsed = await db.aiPlatform.count({ where: { id: { not: excludeId }, logo: oldPath } });
  if (stillUsed > 0) return;
  await deleteUpload(oldPath);
}

export async function saveAiPlatformAction(platformId: string | null, input: unknown): Promise<ActionResult> {
  const user = await requireAdmin();

  const parsed = aiPlatformFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;

  const data = {
    name: v.name,
    description: v.description || null,
    // Normalized by the schema transform — https, no credentials, canonical host.
    url: v.url,
    category: v.category,
    pricingType: v.pricingType,
    freeTierNote: v.freeTierNote || null,
    logo: v.logo || null,
    tags: parseTags(v.tags),
    featured: v.featured,
    published: v.published,
    order: v.order,
  };

  try {
    if (platformId) {
      const id = idSchema.parse(platformId);
      const existing = await db.aiPlatform.findUnique({ where: { id } });
      if (!existing) return { ok: false, error: "Platform not found" };

      const row = await db.aiPlatform.update({ where: { id }, data });
      if (existing.logo !== row.logo) {
        await releaseLogo(existing.logo, row.id, row.logo);
      }
      await logAudit({
        userId: user.id,
        action: "aiPlatform.update",
        entity: "aiPlatform",
        entityId: row.id,
        meta: { name: row.name },
      });
      revalidateSite();
      return { ok: true, id: row.id };
    }

    const last = await db.aiPlatform.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
    const row = await db.aiPlatform.create({
      data: { ...data, order: v.order || (last?.order ?? 0) + 1 },
    });
    await logAudit({
      userId: user.id,
      action: "aiPlatform.create",
      entity: "aiPlatform",
      entityId: row.id,
      meta: { name: row.name },
    });
    revalidateSite();
    return { ok: true, id: row.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "That URL is already listed as an AI platform." };
    }
    console.error("[admin] saveAiPlatform failed:", err);
    return { ok: false, error: "Failed to save platform." };
  }
}

export async function deleteAiPlatformsAction(ids: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Invalid selection" };

  const doomed = await db.aiPlatform.findMany({
    where: { id: { in: parsed.data } },
    select: { logo: true },
  });
  const { count } = await db.aiPlatform.deleteMany({ where: { id: { in: parsed.data } } });

  const candidates = new Set(
    doomed.map((p) => p.logo).filter((p): p is string => typeof p === "string" && p.startsWith("/uploads/"))
  );
  for (const path of candidates) {
    const stillUsed = await db.aiPlatform.count({ where: { logo: path } });
    if (stillUsed === 0) await deleteUpload(path);
  }

  await logAudit({ userId: user.id, action: "aiPlatform.delete", entity: "aiPlatform", meta: { count } });
  revalidateSite();
  return { ok: true };
}

export async function toggleAiPlatformPublishedAction(platformId: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idSchema.safeParse(platformId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const existing = await db.aiPlatform.findUnique({ where: { id: parsed.data }, select: { published: true } });
  if (!existing) return { ok: false, error: "Platform not found" };
  await db.aiPlatform.update({ where: { id: parsed.data }, data: { published: !existing.published } });
  await logAudit({
    userId: user.id,
    action: "aiPlatform.toggle_published",
    entity: "aiPlatform",
    entityId: parsed.data,
  });
  revalidateSite();
  return { ok: true };
}

export async function toggleAiPlatformFeaturedAction(platformId: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idSchema.safeParse(platformId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const existing = await db.aiPlatform.findUnique({ where: { id: parsed.data }, select: { featured: true } });
  if (!existing) return { ok: false, error: "Platform not found" };
  await db.aiPlatform.update({ where: { id: parsed.data }, data: { featured: !existing.featured } });
  await logAudit({
    userId: user.id,
    action: "aiPlatform.toggle_featured",
    entity: "aiPlatform",
    entityId: parsed.data,
  });
  revalidateSite();
  return { ok: true };
}

const reorderSchema = z.object({ id: idSchema, order: z.number().int().min(0).max(100_000) });

export async function setAiPlatformOrderAction(input: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const existing = await db.aiPlatform.findUnique({ where: { id: parsed.data.id }, select: { id: true } });
  if (!existing) return { ok: false, error: "Platform not found" };
  await db.aiPlatform.update({ where: { id: parsed.data.id }, data: { order: parsed.data.order } });
  await logAudit({
    userId: user.id,
    action: "aiPlatform.reorder",
    entity: "aiPlatform",
    entityId: parsed.data.id,
    meta: { order: parsed.data.order },
  });
  revalidateSite();
  return { ok: true };
}
