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

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const idSchema = z.string().cuid();
const idsSchema = z.array(idSchema).min(1).max(200);

function revalidateSite() {
  revalidatePath("/", "layout");
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

  const { count } = await db.course.deleteMany({ where: { id: { in: parsed.data } } });
  await logAudit({
    userId: user.id,
    action: "course.delete",
    entity: "course",
    meta: { count, ids: parsed.data },
  });
  revalidateSite();
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
