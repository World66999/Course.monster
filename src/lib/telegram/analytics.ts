import "server-only";
import { db } from "@/lib/db";

/**
 * Admin dashboard aggregates.
 *
 * Every query here is either a COUNT over an indexed predicate or a grouped
 * COUNT — nothing scans the catalog or the event table row-by-row in
 * application code. The counts are computed on read (no denormalised counters
 * to drift) because the indexes make them cheap at this scale.
 */

function since(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface Overview {
  totalUsers: number;
  activeUsers: number;
  newToday: number;
  newThisWeek: number;
  blockedUsers: number;
  courseViews: number;
  downloadRequests: number;
  completedDownloads: number;
  searches: number;
  upcomingViews: number;
  errors: number;
  lastActivityAt: Date | null;
  viewToRequestRate: number;
  requestToDownloadRate: number;
}

export async function getOverview(): Promise<Overview> {
  const today = startOfToday();
  const week = since(7);

  const [
    totalUsers, activeUsers, newToday, newThisWeek, blockedUsers,
    courseViews, downloadRequests, searches, upcomingViews, errors,
    completedDownloads, latest,
  ] = await Promise.all([
    db.telegramUser.count(),
    db.telegramUser.count({ where: { lastSeenAt: { gte: week } } }),
    db.telegramUser.count({ where: { firstSeenAt: { gte: today } } }),
    db.telegramUser.count({ where: { firstSeenAt: { gte: week } } }),
    db.telegramUser.count({ where: { blocked: true } }),
    db.telegramEvent.count({ where: { type: "COURSE_VIEW" } }),
    db.telegramEvent.count({ where: { type: "DOWNLOAD_REQUESTED" } }),
    db.telegramEvent.count({ where: { type: "SEARCH" } }),
    db.telegramEvent.count({ where: { type: "UPCOMING_VIEW" } }),
    db.telegramEvent.count({ where: { type: "ERROR" } }),
    // The only figure that means a download actually happened: written by
    // /go after the verification gateway let the user through.
    db.downloadEvent.count({ where: { source: "telegram" } }),
    db.telegramUser.findFirst({ orderBy: { lastSeenAt: "desc" }, select: { lastSeenAt: true } }),
  ]);

  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

  return {
    totalUsers, activeUsers, newToday, newThisWeek, blockedUsers,
    courseViews, downloadRequests, searches, upcomingViews, errors,
    completedDownloads,
    lastActivityAt: latest?.lastSeenAt ?? null,
    viewToRequestRate: pct(downloadRequests, courseViews),
    requestToDownloadRate: pct(completedDownloads, downloadRequests),
  };
}

export interface CourseStat {
  courseId: string;
  title: string;
  count: number;
}

/** Courses whose Download button was pressed most often, from the bot. */
export async function getMostRequestedCourses(limit = 10): Promise<CourseStat[]> {
  const grouped = await db.telegramEvent.groupBy({
    by: ["courseId"],
    where: { type: "DOWNLOAD_REQUESTED", courseId: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { courseId: "desc" } },
    take: limit,
  });
  return titlesFor(grouped.map((g) => ({ courseId: g.courseId!, count: g._count._all })));
}

/** Courses actually downloaded through the bot (verified completions). */
export async function getMostDownloadedCourses(limit = 10): Promise<CourseStat[]> {
  const grouped = await db.downloadEvent.groupBy({
    by: ["courseId"],
    where: { source: "telegram" },
    _count: { _all: true },
    orderBy: { _count: { courseId: "desc" } },
    take: limit,
  });
  return titlesFor(grouped.map((g) => ({ courseId: g.courseId, count: g._count._all })));
}

async function titlesFor(rows: { courseId: string; count: number }[]): Promise<CourseStat[]> {
  if (rows.length === 0) return [];
  const courses = await db.course.findMany({
    where: { id: { in: rows.map((r) => r.courseId) } },
    select: { id: true, title: true },
  });
  const byId = new Map(courses.map((c) => [c.id, c.title]));
  return rows.map((r) => ({ ...r, title: byId.get(r.courseId) ?? "(deleted course)" }));
}

export async function getTopSearches(limit = 10): Promise<{ query: string; count: number }[]> {
  const grouped = await db.telegramEvent.groupBy({
    by: ["query"],
    where: { type: "SEARCH", query: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { query: "desc" } },
    take: limit,
  });
  return grouped.map((g) => ({ query: g.query!, count: g._count._all }));
}
