"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth-helpers";
import { logAudit } from "@/lib/audit";
import { learningResourceFormSchema, parseTags } from "@/lib/validation";
import { deleteUpload } from "@/lib/uploads";
import { parseYouTubeUrl } from "@/lib/youtube";
import type { ActionResult } from "@/server/actions/courses";

const idSchema = z.string().cuid();
const idsSchema = z.array(idSchema).min(1).max(200);

function revalidateSite() {
  revalidatePath("/", "layout");
}

async function releaseResourceThumbnail(oldPath: string | null, excludeId: string, keep: string | null): Promise<void> {
  if (!oldPath || !oldPath.startsWith("/uploads/")) return;
  if (keep === oldPath) return;
  const stillUsed = await db.learningResource.count({ where: { id: { not: excludeId }, thumbnail: oldPath } });
  if (stillUsed > 0) return;
  await deleteUpload(oldPath);
}

export async function saveLearningResourceAction(resourceId: string | null, input: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = learningResourceFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const v = parsed.data;

  const parsedUrl = parseYouTubeUrl(v.url);
  if (!parsedUrl || parsedUrl.type === "channel") {
    return { ok: false, error: "URL must be a YouTube video or playlist link." };
  }
  if (v.resourceType === "VIDEO" && parsedUrl.type !== "video") {
    return { ok: false, error: "This URL isn't a video link." };
  }
  if (v.resourceType === "PLAYLIST" && parsedUrl.type !== "playlist") {
    return { ok: false, error: "This URL isn't a playlist link." };
  }

  const data = {
    title: v.title,
    slug: v.slug,
    url: v.url,
    videoId: parsedUrl.type === "video" ? parsedUrl.id : null,
    playlistId: parsedUrl.type === "playlist" ? parsedUrl.id : null,
    thumbnail: v.thumbnail || null,
    resourceType: v.resourceType,
    description: v.description || null,
    creatorName: v.creatorName.trim() || null,
    categoryId: v.categoryId || null,
    tags: parseTags(v.tags),
    skillLevel: v.skillLevel || null,
    spokenLanguage: v.spokenLanguage.trim() || null,
    durationMinutes: v.durationMinutes ?? null,
    featured: v.featured,
    published: v.published,
  };

  try {
    if (resourceId) {
      const id = idSchema.parse(resourceId);
      const existing = await db.learningResource.findUnique({ where: { id } });
      if (!existing) return { ok: false, error: "Resource not found" };

      const resource = await db.learningResource.update({ where: { id }, data });
      if (existing.thumbnail !== resource.thumbnail) {
        await releaseResourceThumbnail(existing.thumbnail, resource.id, resource.thumbnail);
      }
      await logAudit({
        userId: user.id,
        action: "learningResource.update",
        entity: "learningResource",
        entityId: resource.id,
        meta: { title: resource.title },
      });
      revalidateSite();
      return { ok: true, id: resource.id };
    }

    const last = await db.learningResource.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
    const resource = await db.learningResource.create({ data: { ...data, order: (last?.order ?? 0) + 1 } });
    await logAudit({
      userId: user.id,
      action: "learningResource.create",
      entity: "learningResource",
      entityId: resource.id,
      meta: { title: resource.title },
    });
    revalidateSite();
    return { ok: true, id: resource.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "A resource with this slug already exists." };
    }
    console.error("[admin] saveLearningResource failed:", err);
    return { ok: false, error: "Failed to save resource." };
  }
}

export async function deleteLearningResourcesAction(ids: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Invalid selection" };

  const doomed = await db.learningResource.findMany({
    where: { id: { in: parsed.data } },
    select: { thumbnail: true },
  });
  const { count } = await db.learningResource.deleteMany({ where: { id: { in: parsed.data } } });

  const candidates = new Set(doomed.map((r) => r.thumbnail).filter((p): p is string => Boolean(p)));
  for (const path of candidates) {
    if (!path.startsWith("/uploads/")) continue;
    const stillUsed = await db.learningResource.count({ where: { thumbnail: path } });
    if (stillUsed === 0) await deleteUpload(path);
  }

  await logAudit({ userId: user.id, action: "learningResource.delete", entity: "learningResource", meta: { count } });
  revalidateSite();
  return { ok: true };
}

export async function toggleResourcePublishedAction(resourceId: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idSchema.safeParse(resourceId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const existing = await db.learningResource.findUnique({ where: { id: parsed.data }, select: { published: true } });
  if (!existing) return { ok: false, error: "Resource not found" };
  await db.learningResource.update({ where: { id: parsed.data }, data: { published: !existing.published } });
  await logAudit({ userId: user.id, action: "learningResource.toggle_published", entity: "learningResource", entityId: parsed.data });
  revalidateSite();
  return { ok: true };
}

export async function toggleResourceFeaturedAction(resourceId: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idSchema.safeParse(resourceId);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const existing = await db.learningResource.findUnique({ where: { id: parsed.data }, select: { featured: true } });
  if (!existing) return { ok: false, error: "Resource not found" };
  await db.learningResource.update({ where: { id: parsed.data }, data: { featured: !existing.featured } });
  await logAudit({ userId: user.id, action: "learningResource.toggle_featured", entity: "learningResource", entityId: parsed.data });
  revalidateSite();
  return { ok: true };
}
