import type { Metadata } from "next";
import { Users } from "lucide-react";
import { db } from "@/lib/db";
import { EmptyState } from "@/components/site/section";
import { TelegramUsersTable } from "@/components/admin/telegram/telegram-users-table";

export const metadata: Metadata = { title: "Telegram users" };
export const dynamic = "force-dynamic";

export default async function TelegramUsersPage() {
  const users = await db.telegramUser.findMany({
    orderBy: { lastSeenAt: "desc" },
    take: 300,
    select: {
      id: true, telegramId: true, username: true, firstName: true, lastName: true,
      blocked: true, botBlocked: true, firstSeenAt: true, lastSeenAt: true,
    },
  });

  // One grouped query for all activity counts, rather than N per row.
  const [views, requests, completions] = await Promise.all([
    db.telegramEvent.groupBy({ by: ["userId"], where: { type: "COURSE_VIEW" }, _count: { _all: true } }),
    db.telegramEvent.groupBy({ by: ["userId"], where: { type: "DOWNLOAD_REQUESTED" }, _count: { _all: true } }),
    db.downloadEvent.groupBy({
      by: ["telegramUserId"],
      where: { source: "telegram", telegramUserId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const viewsBy = new Map(views.map((v) => [v.userId, v._count._all]));
  const reqBy = new Map(requests.map((v) => [v.userId, v._count._all]));
  const doneBy = new Map(completions.map((v) => [v.telegramUserId!, v._count._all]));

  const rows = users.map((u) => ({
    ...u,
    firstSeenAt: u.firstSeenAt.toISOString(),
    lastSeenAt: u.lastSeenAt.toISOString(),
    courseViews: viewsBy.get(u.id) ?? 0,
    downloadRequests: reqBy.get(u.id) ?? 0,
    completedDownloads: doneBy.get(u.telegramId) ?? 0,
  }));

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Users aria-hidden />}
        title="No bot users yet"
        description="People who start the Telegram bot will appear here."
      />
    );
  }
  return <TelegramUsersTable rows={rows} />;
}
