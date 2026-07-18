import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Download,
  Eye,
  Mail,
  TrendingUp,
} from "lucide-react";
import { db } from "@/lib/db";
import { formatNumber, formatDate } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  const since14d = new Date(Date.now() - 14 * 86_400_000);
  const since7d = new Date(Date.now() - 7 * 86_400_000);

  const [
    courseCount,
    publishedCount,
    downloadsAgg,
    viewsAgg,
    subscriberCount,
    downloads7d,
    recentEvents,
    popularCourses,
    recentAudit,
    eventsForChart,
  ] = await Promise.all([
    db.course.count(),
    db.course.count({ where: { published: true } }),
    db.course.aggregate({ _sum: { downloads: true } }),
    db.course.aggregate({ _sum: { views: true } }),
    db.newsletterSubscriber.count(),
    db.downloadEvent.count({ where: { createdAt: { gte: since7d } } }),
    db.downloadEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { course: { select: { title: true, slug: true } } },
    }),
    db.course.findMany({
      orderBy: { downloads: "desc" },
      take: 5,
      select: { id: true, title: true, slug: true, downloads: true, views: true, published: true },
    }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true } } },
    }),
    db.downloadEvent.findMany({
      where: { createdAt: { gte: since14d } },
      select: { createdAt: true },
    }),
  ]);

  // Bucket the last 14 days of download events by day.
  const days: { label: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000);
    const key = day.toISOString().slice(0, 10);
    days.push({
      label: key.slice(5),
      count: eventsForChart.filter((e) => e.createdAt.toISOString().slice(0, 10) === key).length,
    });
  }

  return {
    stats: {
      courses: courseCount,
      published: publishedCount,
      downloads: downloadsAgg._sum.downloads ?? 0,
      views: viewsAgg._sum.views ?? 0,
      subscribers: subscriberCount,
      downloads7d,
    },
    recentEvents,
    popularCourses,
    recentAudit,
    chart: days,
  };
}

export default async function AdminDashboard() {
  const { stats, recentEvents, popularCourses, recentAudit, chart } = await getDashboardData();
  const maxChart = Math.max(1, ...chart.map((d) => d.count));

  const cards = [
    { label: "Total courses", value: stats.courses, sub: `${stats.published} published`, icon: BookOpen },
    { label: "Total downloads", value: stats.downloads, sub: `${stats.downloads7d} in last 7 days`, icon: Download },
    { label: "Total views", value: stats.views, sub: "across all courses", icon: Eye },
    { label: "Subscribers", value: stats.subscribers, sub: "newsletter", icon: Mail },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What&apos;s happening on your platform right now.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, sub, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{label}</p>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-4.5 w-4.5" aria-hidden />
              </span>
            </div>
            <p className="mt-2 text-3xl font-bold tracking-tight">{formatNumber(value)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Downloads chart */}
        <div className="rounded-2xl border border-border bg-card p-5 xl:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Downloads — last 14 days</h2>
              <p className="text-xs text-muted-foreground">Individual download events</p>
            </div>
            <TrendingUp className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div className="flex h-44 items-end gap-1.5" role="img" aria-label="Bar chart of downloads per day for the last 14 days">
            {chart.map((d) => (
              <div key={d.label} className="group flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  {d.count}
                </span>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-primary to-accent transition-opacity group-hover:opacity-80"
                  style={{ height: `${Math.max(3, (d.count / maxChart) * 130)}px` }}
                  title={`${d.label}: ${d.count} downloads`}
                />
                <span className="text-[10px] text-muted-foreground">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Popular courses */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">Popular courses</h2>
          <ol className="space-y-3">
            {popularCourses.map((course, i) => (
              <li key={course.id}>
                <Link
                  href={`/admin/courses/${course.id}/edit`}
                  className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-muted"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium group-hover:text-primary">
                      {course.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(course.downloads)} downloads · {formatNumber(course.views)} views
                    </p>
                  </div>
                  {!course.published && <Badge variant="secondary">Draft</Badge>}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Recent downloads */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">Recent downloads</h2>
          {recentEvents.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No downloads yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentEvents.map((event) => (
                <li
                  key={event.id}
                  className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-sm"
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <Download className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    <span className="truncate">{event.course.title}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(event.createdAt, { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent activity */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Recent activity</h2>
            <Link
              href="/admin/activity"
              className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
            >
              View all
              <ArrowUpRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
          {recentAudit.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentAudit.map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{log.user?.name ?? "System"}</span>{" "}
                    <span className="text-muted-foreground">{log.action}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground" title={formatDate(log.createdAt)}>
                    {formatDistanceToNow(log.createdAt, { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
