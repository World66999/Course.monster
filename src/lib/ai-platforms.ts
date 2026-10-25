import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { ListAiPlatformsQuery } from "@/lib/validation";

export const aiPlatformCardSelect = {
  id: true,
  name: true,
  description: true,
  url: true,
  category: true,
  pricingType: true,
  freeTierNote: true,
  logo: true,
  tags: true,
  featured: true,
} satisfies Prisma.AiPlatformSelect;

export type AiPlatformCard = Prisma.AiPlatformGetPayload<{
  select: typeof aiPlatformCardSelect;
}>;

/** Total order in every branch — see the note in free-resources.ts. */
function orderBy(sort: ListAiPlatformsQuery["sort"]): Prisma.AiPlatformOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ createdAt: "desc" }, { id: "asc" }];
    case "az":
      return [{ name: "asc" }, { id: "asc" }];
    case "curated":
    default:
      return [{ featured: "desc" }, { order: "asc" }, { createdAt: "desc" }, { id: "asc" }];
  }
}

function buildWhere(query: ListAiPlatformsQuery): Prisma.AiPlatformWhereInput {
  const where: Prisma.AiPlatformWhereInput = { published: true };

  if (query.q) {
    const words = query.q.trim().split(/\s+/).slice(0, 8);
    where.AND = words.map((word) => ({
      OR: [
        { name: { contains: word, mode: "insensitive" as const } },
        { description: { contains: word, mode: "insensitive" as const } },
        { tags: { has: word.toLowerCase() } },
      ],
    }));
  }
  if (query.category) where.category = query.category;
  if (query.pricing) where.pricingType = query.pricing;
  if (query.tag) where.tags = { has: query.tag.toLowerCase() };
  if (query.flag === "featured") where.featured = true;

  return where;
}

export async function listAiPlatforms(
  query: ListAiPlatformsQuery
): Promise<{ items: AiPlatformCard[]; nextCursor: string | null; total: number }> {
  const where = buildWhere(query);

  const [total, items] = await Promise.all([
    db.aiPlatform.count({ where }),
    db.aiPlatform.findMany({
      where,
      select: aiPlatformCardSelect,
      orderBy: orderBy(query.sort),
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

