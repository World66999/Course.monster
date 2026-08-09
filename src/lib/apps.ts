import "server-only";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ListAppListingsQuery } from "@/lib/validation";

export const appCardSelect = {
  id: true,
  slug: true,
  name: true,
  icon: true,
  shortDescription: true,
  developer: true,
  platform: true,
  category: true,
  version: true,
  isOpenSource: true,
  tags: true,
  featured: true,
  views: true,
  createdAt: true,
} satisfies Prisma.AppListingSelect;

export type AppCard = Prisma.AppListingGetPayload<{ select: typeof appCardSelect }>;

function orderBy(sort: ListAppListingsQuery["sort"]): Prisma.AppListingOrderByWithRelationInput[] {
  switch (sort) {
    case "popular":
      return [{ views: "desc" }, { id: "asc" }];
    case "az":
      return [{ name: "asc" }, { id: "asc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

export async function listAppListings(
  query: ListAppListingsQuery
): Promise<{ items: AppCard[]; nextCursor: string | null; total: number }> {
  const where: Prisma.AppListingWhereInput = { published: true };

  if (query.q) {
    const words = query.q.trim().split(/\s+/).slice(0, 8);
    where.AND = words.map((word) => ({
      OR: [
        { name: { contains: word, mode: "insensitive" as const } },
        { shortDescription: { contains: word, mode: "insensitive" as const } },
        { tags: { has: word.toLowerCase() } },
      ],
    }));
  }
  if (query.category) where.category = query.category;
  if (query.platform) where.platform = query.platform;
  if (query.openSource) where.isOpenSource = true;
  if (query.flag === "featured") where.featured = true;

  const [total, items] = await Promise.all([
    db.appListing.count({ where }),
    db.appListing.findMany({
      where,
      select: appCardSelect,
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

export const getPublishedApp = cache(async (slug: string) => {
  return db.appListing.findFirst({ where: { slug, published: true } });
});

export async function getFeaturedApps(limit = 8): Promise<AppCard[]> {
  return db.appListing.findMany({
    where: { published: true, featured: true },
    select: appCardSelect,
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    take: limit,
  });
}
