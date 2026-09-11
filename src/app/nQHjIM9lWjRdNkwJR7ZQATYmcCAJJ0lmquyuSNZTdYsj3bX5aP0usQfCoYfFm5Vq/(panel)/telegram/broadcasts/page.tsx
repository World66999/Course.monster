import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getMostRequestedCourses, getMostDownloadedCourses, getTopSearches } from "@/lib/telegram/analytics";
import { hasBotToken } from "@/lib/telegram/config";
import { BroadcastComposer } from "@/components/admin/telegram/broadcast-composer";
import { BroadcastList } from "@/components/admin/telegram/broadcast-list";

export const metadata: Metadata = { title: "Telegram broadcasts" };
export const dynamic = "force-dynamic";

export default async function TelegramBroadcastsPage() {
  const [broadcasts, audience, requested, downloaded, searches] = await Promise.all([
    db.broadcast.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true, body: true, status: true, totalCount: true, sentCount: true,
        failedCount: true, skippedCount: true, createdAt: true, completedAt: true,
      },
    }),
    db.telegramUser.count({ where: { blocked: false, botBlocked: false } }),
    getMostRequestedCourses(5),
    getMostDownloadedCourses(5),
    getTopSearches(5),
  ]);

  const rows = broadcasts.map((b) => ({ ...b, createdAt: b.createdAt.toISOString() }));

  return (
    <div className="space-y-8">
      <BroadcastComposer audience={audience} configured={hasBotToken()} />
      <BroadcastList rows={rows} />

      <section className="grid gap-6 lg:grid-cols-3">
        <TopList title="📈 Most requested" items={requested.map((r) => ({ label: r.title, count: r.count }))} />
        <TopList title="📊 Most downloaded" items={downloaded.map((r) => ({ label: r.title, count: r.count }))} />
        <TopList title="🔎 Top searches" items={searches.map((r) => ({ label: r.query, count: r.count }))} />
      </section>
    </div>
  );
}

function TopList({ title, items }: { title: string; items: { label: string; count: number }[] }) {
  return (
    <div className="rounded-card border border-border bg-card p-4">
      <h3 className="font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <ol className="mt-3 space-y-2 text-sm">
          {items.map((it, i) => (
            <li key={`${it.label}-${i}`} className="flex items-start justify-between gap-3">
              <span className="min-w-0 truncate">{i + 1}. {it.label}</span>
              <span className="shrink-0 font-medium tabular-nums">{it.count}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
