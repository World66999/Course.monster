import "server-only";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ListCodingChannelsQuery } from "@/lib/validation";

export const channelCardSelect = {
  id: true,
  slug: true,
  name: true,
  url: true,
  logo: true,
  shortDescription: true,
  tags: true,
  spokenLanguage: true,
  skillLevel: true,
  featured: true,
  verified: true,
  views: true,
  bookmarkCount: true,
  createdAt: true,
} satisfies Prisma.CodingChannelSelect;

export type ChannelCard = Prisma.CodingChannelGetPayload<{ select: typeof channelCardSelect }>;

function orderBy(sort: ListCodingChannelsQuery["sort"]): Prisma.CodingChannelOrderByWithRelationInput[] {
  switch (sort) {
    case "popular":
      return [{ bookmarkCount: "desc" }, { views: "desc" }, { id: "asc" }];
    case "az":
      return [{ name: "asc" }, { id: "asc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

export async function listCodingChannels(
  query: ListCodingChannelsQuery,
  userId: string | null
): Promise<{ items: ChannelCard[]; nextCursor: string | null; total: number }> {
  const where: Prisma.CodingChannelWhereInput = { published: true };

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
  if (query.tag) where.tags = { has: query.tag };
  if (query.level) where.skillLevel = query.level;
  if (query.lang) where.spokenLanguage = { equals: query.lang, mode: "insensitive" };
  if (query.flag === "featured") where.featured = true;
  else if (query.flag === "verified") where.verified = true;
  if (query.bookmarked && userId) where.bookmarks = { some: { userId } };

  const [total, items] = await Promise.all([
    db.codingChannel.count({ where }),
    db.codingChannel.findMany({
      where,
      select: channelCardSelect,
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

export const getPublishedChannel = cache(async (slug: string) => {
  return db.codingChannel.findFirst({ where: { slug, published: true } });
});

/** Distinct tags across published channels, for the filter UI. */
export async function getChannelTags(): Promise<string[]> {
  const rows = await db.codingChannel.findMany({
    where: { published: true },
    select: { tags: true },
  });
  const set = new Set<string>();
  for (const r of rows) for (const t of r.tags) set.add(t);
  return [...set].sort();
}

export async function getFeaturedChannels(limit = 6): Promise<ChannelCard[]> {
  return db.codingChannel.findMany({
    where: { published: true, featured: true },
    select: channelCardSelect,
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    take: limit,
  });
}

export interface MyChannelState {
  bookmarked: boolean;
}

/** Batched IN-query per-user state, same pattern as attachMyRequestState. */
export async function attachMyChannelState<T extends { id: string }>(
  items: T[],
  userId: string | null
): Promise<Map<string, MyChannelState>> {
  const result = new Map<string, MyChannelState>();
  for (const item of items) result.set(item.id, { bookmarked: false });
  if (!userId || items.length === 0) return result;
  const ids = items.map((i) => i.id);
  const bookmarks = await db.codingChannelBookmark.findMany({
    where: { userId, channelId: { in: ids } },
    select: { channelId: true },
  });
  for (const b of bookmarks) result.get(b.channelId)!.bookmarked = true;
  return result;
}
