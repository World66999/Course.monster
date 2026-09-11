import "server-only";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ListLearningResourcesQuery } from "@/lib/validation";

export const resourceCardSelect = {
  id: true,
  slug: true,
  title: true,
  url: true,
  videoId: true,
  playlistId: true,
  thumbnail: true,
  resourceType: true,
  creatorName: true,
  tags: true,
  skillLevel: true,
  spokenLanguage: true,
  durationMinutes: true,
  featured: true,
  views: true,
  bookmarkCount: true,
  createdAt: true,
  category: { select: { name: true, slug: true } },
} satisfies Prisma.LearningResourceSelect;

export type ResourceCard = Prisma.LearningResourceGetPayload<{ select: typeof resourceCardSelect }>;

function orderBy(
  sort: ListLearningResourcesQuery["sort"]
): Prisma.LearningResourceOrderByWithRelationInput[] {
  switch (sort) {
    case "popular":
      return [{ bookmarkCount: "desc" }, { views: "desc" }, { id: "asc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

export async function listLearningResources(
  query: ListLearningResourcesQuery,
  userId: string | null
): Promise<{ items: ResourceCard[]; nextCursor: string | null; total: number }> {
  const where: Prisma.LearningResourceWhereInput = { published: true };

  if (query.q) {
    const words = query.q.trim().split(/\s+/).slice(0, 8);
    where.AND = words.map((word) => ({
      OR: [
        { title: { contains: word, mode: "insensitive" as const } },
        { description: { contains: word, mode: "insensitive" as const } },
        { tags: { has: word.toLowerCase() } },
      ],
    }));
  }
  if (query.category) where.category = { slug: query.category };
  if (query.tag) where.tags = { has: query.tag };
  if (query.level) where.skillLevel = query.level;
  if (query.lang) where.spokenLanguage = { equals: query.lang, mode: "insensitive" };
  if (query.type) where.resourceType = query.type;
  if (query.flag === "featured") where.featured = true;
  if (query.bookmarked && userId) where.bookmarks = { some: { userId } };

  const [total, items] = await Promise.all([
    db.learningResource.count({ where }),
    db.learningResource.findMany({
      where,
      select: resourceCardSelect,
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

export const getPublishedResource = cache(async (slug: string) => {
  return db.learningResource.findFirst({
    where: { slug, published: true },
    include: { category: { select: { name: true, slug: true } } },
  });
});


export async function getResourceCategories() {
  return db.category.findMany({
    where: { learningResources: { some: { published: true } } },
    orderBy: { order: "asc" },
    include: { _count: { select: { learningResources: { where: { published: true } } } } },
  });
}

export interface MyResourceState {
  bookmarked: boolean;
}

export async function attachMyResourceState<T extends { id: string }>(
  items: T[],
  userId: string | null
): Promise<Map<string, MyResourceState>> {
  const result = new Map<string, MyResourceState>();
  for (const item of items) result.set(item.id, { bookmarked: false });
  if (!userId || items.length === 0) return result;
  const ids = items.map((i) => i.id);
  const bookmarks = await db.learningResourceBookmark.findMany({
    where: { userId, resourceId: { in: ids } },
    select: { resourceId: true },
  });
  for (const b of bookmarks) result.get(b.resourceId)!.bookmarked = true;
  return result;
}
