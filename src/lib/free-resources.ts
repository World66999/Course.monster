import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ListFreeResourcesQuery } from "@/lib/validation";

/**
 * Only the columns a card renders. `description` is included because the card
 * shows a clamped excerpt; nothing here selects a column the UI never reads,
 * so the row payload shipped to the client stays small.
 */
export const freeResourceCardSelect = {
  id: true,
  title: true,
  description: true,
  url: true,
  sourceType: true,
  category: true,
  thumbnail: true,
  tags: true,
  featured: true,
} satisfies Prisma.FreeResourceSelect;

export type FreeResourceCard = Prisma.FreeResourceGetPayload<{
  select: typeof freeResourceCardSelect;
}>;

/**
 * Every ordering ends in `id` so it is a total order. Without that tiebreak,
 * rows sharing an `order`/`createdAt` have no defined sequence, and cursor
 * pagination can repeat or skip them between pages.
 */
function orderBy(
  sort: ListFreeResourcesQuery["sort"]
): Prisma.FreeResourceOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ createdAt: "desc" }, { id: "asc" }];
    case "az":
      return [{ title: "asc" }, { id: "asc" }];
    case "curated":
    default:
      // Admin-controlled display order first, newest within a rank.
      return [{ featured: "desc" }, { order: "asc" }, { createdAt: "desc" }, { id: "asc" }];
  }
}

function buildWhere(query: ListFreeResourcesQuery): Prisma.FreeResourceWhereInput {
  const where: Prisma.FreeResourceWhereInput = { published: true };

  if (query.q) {
    // Same shape as listAppListings: every word must match somewhere (AND of
    // ORs), capped at 8 words so a pathological query can't build a huge plan.
    const words = query.q.trim().split(/\s+/).slice(0, 8);
    where.AND = words.map((word) => ({
      OR: [
        { title: { contains: word, mode: "insensitive" as const } },
        { description: { contains: word, mode: "insensitive" as const } },
        { tags: { has: word.toLowerCase() } },
      ],
    }));
  }
  if (query.category) where.category = query.category;
  if (query.source) where.sourceType = query.source;
  if (query.tag) where.tags = { has: query.tag.toLowerCase() };
  if (query.flag === "featured") where.featured = true;

  return where;
}

export async function listFreeResources(
  query: ListFreeResourcesQuery
): Promise<{ items: FreeResourceCard[]; nextCursor: string | null; total: number }> {
  const where = buildWhere(query);

  const [total, items] = await Promise.all([
    db.freeResource.count({ where }),
    db.freeResource.findMany({
      where,
      select: freeResourceCardSelect,
      orderBy: orderBy(query.sort),
      // One extra row tells us whether another page exists without a second query.
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    }),
  ]);

  let nextCursor: string | null = null;
  if (items.length > query.limit) {
    nextCursor = items.pop()!.id;
  }
  return { items, nextCursor, total };
}

export async function getFeaturedFreeResources(limit = 6): Promise<FreeResourceCard[]> {
  return db.freeResource.findMany({
    where: { published: true, featured: true },
    select: freeResourceCardSelect,
    orderBy: [{ order: "asc" }, { createdAt: "desc" }, { id: "asc" }],
    take: limit,
  });
}

/**
 * Tag cloud for the filter bar. Bounded scan: only published rows, only the
 * `tags` column, capped — this must never become a full-table read as the
 * directory grows.
 */
export async function getFreeResourceTags(limit = 24): Promise<string[]> {
  const rows = await db.freeResource.findMany({
    where: { published: true },
    select: { tags: true },
    take: 500,
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const tag of row.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}
