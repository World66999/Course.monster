import "server-only";
import { cache } from "react";
import { Prisma, type SkillLevel } from "@prisma/client";
import { db } from "@/lib/db";
import type { ListCoursesQuery } from "@/lib/validation";

export const courseCardSelect = {
  id: true,
  slug: true,
  title: true,
  shortDescription: true,
  thumbnail: true,
  sizeLabel: true,
  lecturesCount: true,
  skillLevel: true,
  durationHours: true,
  downloads: true,
  views: true,
  featured: true,
  trending: true,
  premium: true,
  contentUpdatedAt: true,
  createdAt: true,
  category: { select: { name: true, slug: true } },
} satisfies Prisma.CourseSelect;

export type CourseCard = Prisma.CourseGetPayload<{ select: typeof courseCardSelect }>;

function orderBy(sort: ListCoursesQuery["sort"]): Prisma.CourseOrderByWithRelationInput[] {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "popular":
      return [{ downloads: "desc" }, { id: "asc" }];
    case "az":
      return [{ title: "asc" }, { id: "asc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

export async function listCourses(query: ListCoursesQuery): Promise<{
  items: CourseCard[];
  nextCursor: string | null;
  total: number;
}> {
  const where: Prisma.CourseWhereInput = { published: true };

  if (query.q) {
    // Every word must match somewhere (title, blurb, or tag), so multi-word
    // queries like "advanced react" find "React — Advanced Patterns" instead
    // of requiring the exact phrase.
    const words = query.q.trim().split(/\s+/).slice(0, 8);
    where.AND = words.map((word) => ({
      OR: [
        { title: { contains: word, mode: "insensitive" as const } },
        { shortDescription: { contains: word, mode: "insensitive" as const } },
        { tags: { has: word.toLowerCase() } },
      ],
    }));
  }
  if (query.category) where.category = { slug: query.category };
  if (query.tag) where.tags = { has: query.tag };
  if (query.level) where.skillLevel = query.level.toUpperCase() as SkillLevel;
  if (query.lang) where.language = { equals: query.lang, mode: "insensitive" };
  if (query.duration === "short") where.durationHours = { gt: 0, lte: 5 };
  else if (query.duration === "medium") where.durationHours = { gt: 5, lte: 20 };
  else if (query.duration === "long") where.durationHours = { gt: 20 };
  if (query.flag === "featured") where.featured = true;
  else if (query.flag === "trending") where.trending = true;
  else if (query.flag === "popular") where.popular = true;

  const [total, items] = await Promise.all([
    db.course.count({ where }),
    db.course.findMany({
      where,
      select: courseCardSelect,
      orderBy: orderBy(query.sort),
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    }),
  ]);

  let nextCursor: string | null = null;
  if (items.length > query.limit) {
    const next = items.pop()!;
    nextCursor = next.id;
  }
  return { items, nextCursor, total };
}

/** Cached per-request: generateMetadata() and the page component both call this for the same slug. */
export const getPublishedCourse = cache(async (slug: string) => {
  return db.course.findFirst({
    where: { slug, published: true },
    include: { category: { select: { name: true, slug: true } } },
  });
});

export async function getRelatedCourses(course: {
  id: string;
  categoryId: string | null;
  tags: string[];
}): Promise<CourseCard[]> {
  const related = await db.course.findMany({
    where: {
      published: true,
      id: { not: course.id },
      OR: [
        ...(course.categoryId ? [{ categoryId: course.categoryId }] : []),
        ...(course.tags.length ? [{ tags: { hasSome: course.tags } }] : []),
      ],
    },
    select: courseCardSelect,
    orderBy: [{ downloads: "desc" }],
    take: 4,
  });
  if (related.length >= 4) return related;

  const fill = await db.course.findMany({
    where: { published: true, id: { notIn: [course.id, ...related.map((c) => c.id)] } },
    select: courseCardSelect,
    orderBy: [{ downloads: "desc" }],
    take: 4 - related.length,
  });
  return [...related, ...fill];
}

export async function getHomepageData() {
  const [featured, trending, mostDownloaded, recent, categories, stats] = await Promise.all([
    db.course.findMany({
      where: { published: true, featured: true },
      select: courseCardSelect,
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      take: 6,
    }),
    db.course.findMany({
      where: { published: true, trending: true },
      select: courseCardSelect,
      orderBy: [{ downloads: "desc" }],
      take: 6,
    }),
    db.course.findMany({
      where: { published: true, downloads: { gt: 0 } },
      select: courseCardSelect,
      orderBy: [{ downloads: "desc" }, { id: "asc" }],
      take: 6,
    }),
    db.course.findMany({
      where: { published: true },
      select: courseCardSelect,
      orderBy: [{ createdAt: "desc" }],
      take: 8,
    }),
    getAllCategories(),
    getSiteStats(),
  ]);
  return { featured, trending, mostDownloaded, recent, categories, stats };
}

export async function getSiteStats() {
  const [courseCount, categoryCount, downloadsAgg] = await Promise.all([
    db.course.count({ where: { published: true } }),
    db.category.count(),
    db.course.aggregate({ _sum: { downloads: true }, where: { published: true } }),
  ]);
  return {
    courses: courseCount,
    categories: categoryCount,
    downloads: downloadsAgg._sum.downloads ?? 0,
  };
}

/**
 * Distinct languages across published courses, for the language filter.
 *
 * Raw SQL because Prisma's `distinct:` is a client-side dedupe here, not a
 * pushdown. Verified by logging the emitted query: `findMany({ distinct:
 * ["language"], orderBy: { language: "asc" } })` produced
 * `SELECT id, language FROM courses WHERE published AND language IS NOT NULL
 * ORDER BY language ASC` with no DISTINCT clause at all — so every published
 * course was transferred to Node on every /courses load, to render a dropdown
 * with a handful of entries. The same caveat is already noted in
 * lib/telegram/admin.ts, where a previous audit hit it from the other direction.
 *
 * Nothing is interpolated: the table and the predicate are fixed.
 */
export async function getCourseLanguages(): Promise<string[]> {
  const rows = await db.$queryRaw<{ language: string }[]>`
    SELECT DISTINCT "language"
    FROM courses
    WHERE "published" = true AND "language" IS NOT NULL
    ORDER BY "language" ASC
  `;
  return rows.map((r) => r.language).filter(Boolean);
}

export async function getAllCategories() {
  return db.category.findMany({
    where: { courses: { some: { published: true } } },
    orderBy: { order: "asc" },
    include: { _count: { select: { courses: { where: { published: true } } } } },
  });
}
