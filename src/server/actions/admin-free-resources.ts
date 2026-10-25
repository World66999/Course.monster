"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth-helpers";
import { logAudit } from "@/lib/audit";
import { freeResourceFormSchema, parseTags } from "@/lib/validation";
import { detectSourceType } from "@/lib/external-resource";
import { deleteOrphanedUploads, deleteUpload } from "@/lib/uploads";
import type { ActionResult } from "@/server/actions/courses";

const idSchema = z.string().cuid();
const idsSchema = z.array(idSchema).min(1).max(200);

function revalidateSite() {
  revalidatePath("/", "layout");
}

/**
 * Delete an upload that no other row still points at. Same guard as the Apps
 * Hub: two rows may legitimately share one uploaded thumbnail, so the file is
 * only removed once nothing references it.
 */
async function releaseThumbnail(oldPath: string | null, excludeId: string, keep: string | null): Promise<void> {
  if (!oldPath || !oldPath.startsWith("/uploads/")) return;
  if (keep === oldPath) return;
  const stillUsed = await db.freeResource.count({ where: { id: { not: excludeId }, thumbnail: oldPath } });
  if (stillUsed > 0) return;
  await deleteUpload(oldPath);
}

export async function saveFreeResourceAction(resourceId: string | null, input: unknown): Promise<ActionResult> {
  // Throws (never returns) for a non-staff or disabled session — the boundary
  // fails closed. safeAction() on the client turns that into a toast.
  const user = await requireAdmin();

  const parsed = freeResourceFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;

  const data = {
    title: v.title,
    description: v.description || null,
    // Already normalized by the schema's transform (https, no credentials,
    // canonical host). Never store the raw client string.
    url: v.url,
    /**
     * Derived here, never accepted from the form. The badge a visitor uses to
     * judge an outbound link must follow the URL that link actually points at,
     * so a crafted POST cannot mark an arbitrary host as "MEGA" or "Telegram".
     */
    sourceType: detectSourceType(v.url),
    category: v.category,
    thumbnail: v.thumbnail || null,
    tags: parseTags(v.tags),
    featured: v.featured,
    published: v.published,
    order: v.order,
  };

  try {
    if (resourceId) {
      const id = idSchema.parse(resourceId);
      const existing = await db.freeResource.findUnique({ where: { id } });
      if (!existing) return { ok: false, error: "Resource not found" };

      const row = await db.freeResource.update({ where: { id }, data });
      if (existing.thumbnail !== row.thumbnail) {
        await releaseThumbnail(existing.thumbnail, row.id, row.thumbnail);
      }
      await logAudit({
        userId: user.id,
        action: "freeResource.update",
        entity: "freeResource",
        entityId: row.id,
        meta: { title: row.title },
      });
      revalidateSite();
      return { ok: true, id: row.id };
    }

    const last = await db.freeResource.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
    const row = await db.freeResource.create({
      data: { ...data, order: v.order || (last?.order ?? 0) + 1 },
    });
    await logAudit({
      userId: user.id,
      action: "freeResource.create",
      entity: "freeResource",
      entityId: row.id,
      meta: { title: row.title },
    });
    revalidateSite();
    return { ok: true, id: row.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "That URL is already in the resource directory." };
    }
    // Log the real error server-side; return a message with no internals in it.
    console.error("[admin] saveFreeResource failed:", err);
    return { ok: false, error: "Failed to save resource." };
  }
}

export async function deleteFreeResourcesAction(ids: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Invalid selection" };

  const doomed = await db.freeResource.findMany({
    where: { id: { in: parsed.data } },
    select: { thumbnail: true },
  });
  const { count } = await db.freeResource.deleteMany({ where: { id: { in: parsed.data } } });

  await deleteOrphanedUploads(
    doomed.map((r) => r.thumbnail),
    async (paths) => {
      const rows = await db.freeResource.findMany({
        where: { thumbnail: { in: paths } },
        select: { thumbnail: true },
      });
      return rows.map((r) => r.thumbnail).filter((p): p is string => Boolean(p));
    }
  );

  await logAudit({ userId: user.id, action: "freeResource.delete", entity: "freeResource", meta: { count } });
  revalidateSite();
  return { ok: true };
}

export async function toggleFreeResourcePublishedAction(resourceId: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idSchema.safeParse(resourceId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const existing = await db.freeResource.findUnique({
    where: { id: parsed.data },
    select: { published: true },
  });
  if (!existing) return { ok: false, error: "Resource not found" };
  await db.freeResource.update({ where: { id: parsed.data }, data: { published: !existing.published } });
  await logAudit({
    userId: user.id,
    action: "freeResource.toggle_published",
    entity: "freeResource",
    entityId: parsed.data,
  });
  revalidateSite();
  return { ok: true };
}

export async function toggleFreeResourceFeaturedAction(resourceId: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idSchema.safeParse(resourceId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const existing = await db.freeResource.findUnique({
    where: { id: parsed.data },
    select: { featured: true },
  });
  if (!existing) return { ok: false, error: "Resource not found" };
  await db.freeResource.update({ where: { id: parsed.data }, data: { featured: !existing.featured } });
  await logAudit({
    userId: user.id,
    action: "freeResource.toggle_featured",
    entity: "freeResource",
    entityId: parsed.data,
  });
  revalidateSite();
  return { ok: true };
}

const reorderSchema = z.object({ id: idSchema, order: z.number().int().min(0).max(100_000) });

/** Persist a new display order for one row (the ▲/▼ controls in the table). */
export async function setFreeResourceOrderAction(input: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const existing = await db.freeResource.findUnique({ where: { id: parsed.data.id }, select: { id: true } });
  if (!existing) return { ok: false, error: "Resource not found" };
  await db.freeResource.update({ where: { id: parsed.data.id }, data: { order: parsed.data.order } });
  await logAudit({
    userId: user.id,
    action: "freeResource.reorder",
    entity: "freeResource",
    entityId: parsed.data.id,
    meta: { order: parsed.data.order },
  });
  revalidateSite();
  return { ok: true };
}
