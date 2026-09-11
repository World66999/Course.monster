"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/server/auth-helpers";
import { logAudit } from "@/lib/audit";
import { courseFormSchema, parseLines, parseTags } from "@/lib/validation";
import { invalidateShortLinks } from "@/lib/shortener";
import { slugify } from "@/lib/utils";
import { deleteOrphanedUploads, deleteUpload } from "@/lib/uploads";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const idSchema = z.string().cuid();
const idsSchema = z.array(idSchema).min(1).max(200);
const courseImageFieldSchema = z.enum(["thumbnail", "banner", "metaImage"]);
const uploadPathSchema = z.string().regex(/^\/uploads\/[a-zA-Z0-9._-]+$/);

function revalidateSite() {
  revalidatePath("/", "layout");
}

/**
 * Deletes an uploaded course image from disk, but only once nothing else
 * still points at it — duplicateCourseAction() intentionally copies
 * thumbnail/banner/metaImage by reference, so the same file can legitimately
 * be shared across multiple course rows (or across fields on the same row).
 * Never touches external (non-/uploads/) URLs.
 */
async function releaseCourseImage(
  oldPath: string | null,
  excludeCourseId: string,
  keepPaths: (string | null)[]
): Promise<void> {
  if (!oldPath || !oldPath.startsWith("/uploads/")) return;
  if (keepPaths.includes(oldPath)) return;
  const stillUsed = await db.course.count({
    where: {
      id: { not: excludeCourseId },
      OR: [{ thumbnail: oldPath }, { banner: oldPath }, { metaImage: oldPath }],
    },
  });
  if (stillUsed > 0) return;
  await deleteUpload(oldPath);
}

export async function saveCourseAction(
  courseId: string | null,
  input: unknown
): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = courseFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const v = parsed.data;

  const data = {
    title: v.title,
    slug: v.slug,
    shortDescription: v.shortDescription || null,
    description: v.description,
    thumbnail: v.thumbnail || null,
    banner: v.banner || null,
    categoryId: v.categoryId || null,
    tags: parseTags(v.tags),
    downloadUrl: v.downloadUrl,
    telegramUrl: v.telegramUrl || null,
    sizeLabel: v.sizeLabel || null,
    lecturesCount: v.lecturesCount ?? null,
    skillLevel: v.skillLevel || null,
    language: v.language.trim() || null,
    durationHours: v.durationHours && v.durationHours > 0 ? v.durationHours : null,
    instructor: v.instructor.trim() || null,
    publisher: v.publisher.trim() || null,
    sourceUrl: v.sourceUrl || null,
    prerequisites: parseLines(v.prerequisites),
    learningOutcomes: parseLines(v.learningOutcomes),
    certificate: v.certificate === "unset" ? null : v.certificate === "yes",
    lifetimeAccess: v.lifetimeAccess === "unset" ? null : v.lifetimeAccess === "yes",
    availableAt: v.availableAt ? new Date(`${v.availableAt}T00:00:00.000Z`) : null,
    published: v.published,
    featured: v.featured,
    trending: v.trending,
    popular: v.popular,
    seoTitle: v.seoTitle || null,
    seoDescription: v.seoDescription || null,
    metaImage: v.metaImage || null,
  };

  try {
    if (courseId) {
      const id = idSchema.parse(courseId);
      const existing = await db.course.findUnique({ where: { id } });
      if (!existing) return { ok: false, error: "Course not found" };

      const course = await db.course.update({
        where: { id },
        data: {
          ...data,
          contentUpdatedAt: new Date(),
        },
      });
      if (existing.downloadUrl !== course.downloadUrl) {
        await invalidateShortLinks(course.id);
      }
      // Clean up replaced/cleared images now that the update has committed —
      // never delete before the DB write succeeds, so a failed save can
      // never leave a dangling reference to an already-deleted file.
      const keep = [course.thumbnail, course.banner, course.metaImage];
      if (existing.thumbnail !== course.thumbnail) {
        await releaseCourseImage(existing.thumbnail, course.id, keep);
      }
      if (existing.banner !== course.banner) {
        await releaseCourseImage(existing.banner, course.id, keep);
      }
      if (existing.metaImage !== course.metaImage) {
        await releaseCourseImage(existing.metaImage, course.id, keep);
      }
      await logAudit({
        userId: user.id,
        action: "course.update",
        entity: "course",
        entityId: course.id,
        meta: { title: course.title },
      });
      revalidateSite();
      return { ok: true, id: course.id };
    }

    const last = await db.course.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
    const course = await db.course.create({
      data: { ...data, order: (last?.order ?? 0) + 1 },
    });
    await logAudit({
      userId: user.id,
      action: "course.create",
      entity: "course",
      entityId: course.id,
      meta: { title: course.title },
    });
    revalidateSite();
    return { ok: true, id: course.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "A course with this slug already exists." };
    }
    console.error("[admin] saveCourse failed:", err);
    return { ok: false, error: "Failed to save course." };
  }
}

export async function deleteCoursesAction(ids: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Invalid selection" };

  const doomed = await db.course.findMany({
    where: { id: { in: parsed.data } },
    select: { thumbnail: true, banner: true, metaImage: true },
  });
  const { count } = await db.course.deleteMany({ where: { id: { in: parsed.data } } });

  // Clean up images that only the now-deleted courses referenced. Checked
  // against what's left in the table, not the pre-delete row set, so an
  // image shared with a course outside this batch is correctly kept — and in
  // one query for the whole batch rather than one per candidate path.
  await deleteOrphanedUploads(
    doomed.flatMap((c) => [c.thumbnail, c.banner, c.metaImage]),
    async (paths) => {
      const rows = await db.course.findMany({
        where: {
          OR: [
            { thumbnail: { in: paths } },
            { banner: { in: paths } },
            { metaImage: { in: paths } },
          ],
        },
        select: { thumbnail: true, banner: true, metaImage: true },
      });
      return rows.flatMap((r) => [r.thumbnail, r.banner, r.metaImage]).filter((p): p is string => Boolean(p));
    }
  );

  await logAudit({
    userId: user.id,
    action: "course.delete",
    entity: "course",
    meta: { count, ids: parsed.data },
  });
  revalidateSite();
  return { ok: true };
}

/**
 * Immediately clears one image field on an existing course and deletes the
 * old file — independent of the rest of the edit form, so "Delete" doesn't
 * require hitting Save on unrelated in-progress changes.
 */
export async function deleteCourseImageAction(courseId: unknown, field: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsedId = idSchema.safeParse(courseId);
  const parsedField = courseImageFieldSchema.safeParse(field);
  if (!parsedId.success || !parsedField.success) return { ok: false, error: "Invalid request" };

  const existing = await db.course.findUnique({ where: { id: parsedId.data } });
  if (!existing) return { ok: false, error: "Course not found" };

  const oldPath = existing[parsedField.data];
  const course = await db.course.update({
    where: { id: parsedId.data },
    data: { [parsedField.data]: null },
  });

  const keep = [course.thumbnail, course.banner, course.metaImage];
  await releaseCourseImage(oldPath, course.id, keep);

  await logAudit({
    userId: user.id,
    action: "course.image_delete",
    entity: "course",
    entityId: course.id,
    meta: { field: parsedField.data },
  });
  revalidateSite();
  return { ok: true };
}

/**
 * Deletes a file that was uploaded but never attached to a saved course row
 * (a new-course draft) or that belongs to another admin upload surface
 * (site settings' logo/favicon/meta image) — no DB row to touch, just the
 * physical file, and only ever within our own uploads directory.
 */
export async function deleteUploadedFileAction(path: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = uploadPathSchema.safeParse(path);
  if (!parsed.success) return { ok: false, error: "Invalid file path" };

  await deleteUpload(parsed.data);
  return { ok: true };
}

export async function setPublishedAction(ids: unknown, published: boolean): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idsSchema.safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Invalid selection" };

  const { count } = await db.course.updateMany({
    where: { id: { in: parsed.data } },
    data: { published },
  });
  await logAudit({
    userId: user.id,
    action: published ? "course.publish" : "course.unpublish",
    entity: "course",
    meta: { count, ids: parsed.data },
  });
  revalidateSite();
  return { ok: true };
}

export async function duplicateCourseAction(id: unknown): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid course" };

  const source = await db.course.findUnique({ where: { id: parsed.data } });
  if (!source) return { ok: false, error: "Course not found" };

  const baseSlug = slugify(`${source.slug}-copy`);
  let slug = baseSlug;
  for (let i = 2; await db.course.findUnique({ where: { slug } }); i++) {
    slug = `${baseSlug}-${i}`;
  }

  const last = await db.course.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
  const copy = await db.course.create({
    data: {
      title: `${source.title} (Copy)`,
      slug,
      shortDescription: source.shortDescription,
      description: source.description,
      thumbnail: source.thumbnail,
      banner: source.banner,
      categoryId: source.categoryId,
      tags: source.tags,
      downloadUrl: source.downloadUrl,
      telegramUrl: source.telegramUrl,
      sizeLabel: source.sizeLabel,
      lecturesCount: source.lecturesCount,
      published: false,
      featured: false,
      trending: false,
      seoTitle: source.seoTitle,
      seoDescription: source.seoDescription,
      metaImage: source.metaImage,
      order: (last?.order ?? 0) + 1,
    },
  });
  await logAudit({
    userId: user.id,
    action: "course.duplicate",
    entity: "course",
    entityId: copy.id,
    meta: { sourceId: source.id, title: copy.title },
  });
  revalidateSite();
  return { ok: true, id: copy.id };
}

export async function moveCourseAction(id: unknown, direction: "up" | "down"): Promise<ActionResult> {
  const user = await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid course" };

  const course = await db.course.findUnique({ where: { id: parsed.data } });
  if (!course) return { ok: false, error: "Course not found" };

  const neighbor = await db.course.findFirst({
    where: direction === "up" ? { order: { lt: course.order } } : { order: { gt: course.order } },
    orderBy: direction === "up" ? { order: "desc" } : { order: "asc" },
  });
  if (!neighbor) return { ok: true };

  await db.$transaction([
    db.course.update({ where: { id: course.id }, data: { order: neighbor.order } }),
    db.course.update({ where: { id: neighbor.id }, data: { order: course.order } }),
  ]);
  await logAudit({
    userId: user.id,
    action: "course.reorder",
    entity: "course",
    entityId: course.id,
    meta: { direction },
  });
  revalidateSite();
  return { ok: true };
}
