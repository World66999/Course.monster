import "server-only";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * The bot's read path into the catalog.
 *
 * There is no Telegram-side course table: every one of these queries hits the
 * same `courses` rows the website serves, filtered by the same
 * `published: true` gate. Publishing, editing, unpublishing or deleting a
 * course on the website therefore changes the bot's output on the next query,
 * with no sync step and nothing to invalidate.
 */

export const PAGE_SIZE = 5;

/** Fields the bot needs — deliberately not `downloadUrl`, which never leaves the server. */
const SELECT = {
  id: true,
  slug: true,
  title: true,
  shortDescription: true,
  description: true,
  sizeLabel: true,
  lecturesCount: true,
  durationHours: true,
  instructor: true,
  skillLevel: true,
  language: true,
  availableAt: true,
  createdAt: true,
  updatedAt: true,
  premium: true,
  category: { select: { name: true } },
} satisfies Prisma.CourseSelect;

export type BotCourse = Prisma.CourseGetPayload<{ select: typeof SELECT }>;

export interface Page {
  items: BotCourse[];
  page: number;
  totalPages: number;
  total: number;
}

/**
 * Total ordering, so paging is deterministic: `createdAt` alone can tie, and a
 * tie makes OFFSET paging drop or repeat rows. The `id` tiebreak removes that.
 */
const ORDER: Prisma.CourseOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "desc" }];

async function paged(where: Prisma.CourseWhereInput, page: number): Promise<Page> {
  const total = await db.course.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Clamp rather than trust the requested page — it arrives from callback data.
  const safePage = Math.min(Math.max(1, page), totalPages);
  const items = total
    ? await db.course.findMany({
        where,
        select: SELECT,
        orderBy: ORDER,
        skip: (safePage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      })
    : [];
  return { items, page: safePage, totalPages, total };
}

export function listPublishedPage(page: number): Promise<Page> {
  return paged({ published: true }, page);
}

/**
 * Upcoming = not yet published, with an admin-entered future date. The date is
 * always a real stored value; nothing here invents one.
 */
export function listUpcomingPage(page: number): Promise<Page> {
  return paged({ published: false, availableAt: { gt: new Date() } }, page);
}

/**
 * Server-side search over the published catalog. Prisma parameterises every
 * value, so the user's text is never concatenated into SQL. Query length is
 * capped and split into a bounded number of terms so a pathological input
 * cannot turn into an unbounded query.
 */
export function searchPublishedPage(rawQuery: string, page: number): Promise<Page> {
  const words = rawQuery.trim().slice(0, 100).split(/\s+/).filter(Boolean).slice(0, 6);
  if (words.length === 0) return listPublishedPage(page);
  const where: Prisma.CourseWhereInput = {
    published: true,
    AND: words.map((word) => ({
      OR: [
        { title: { contains: word, mode: "insensitive" as const } },
        { shortDescription: { contains: word, mode: "insensitive" as const } },
        { tags: { has: word.toLowerCase() } },
      ],
    })),
  };
  return paged(where, page);
}

/**
 * Resolves a course id from untrusted callback data. Returns null unless the
 * course exists *and* is currently published, so an unpublished or deleted
 * course stops being reachable the moment it changes on the website.
 */
export async function getPublishedBotCourse(courseId: string): Promise<BotCourse | null> {
  return db.course.findFirst({ where: { id: courseId, published: true }, select: SELECT });
}

/** Deep-link resolution by public slug, under the same published gate. */
export async function getPublishedBotCourseBySlug(slug: string): Promise<BotCourse | null> {
  return db.course.findFirst({ where: { slug, published: true }, select: SELECT });
}

/** Upcoming courses are viewable but never downloadable. */
export async function getUpcomingBotCourse(courseId: string): Promise<BotCourse | null> {
  return db.course.findFirst({
    where: { id: courseId, published: false, availableAt: { gt: new Date() } },
    select: SELECT,
  });
}
