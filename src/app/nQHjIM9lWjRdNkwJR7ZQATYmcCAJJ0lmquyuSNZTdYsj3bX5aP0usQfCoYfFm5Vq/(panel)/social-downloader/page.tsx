import type { Metadata } from "next";
import { Activity, CheckCircle2, CloudDownload, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { PLATFORM_LABELS, PLATFORMS, type Platform } from "@/lib/social-download";
import { SocialMaintenance } from "@/components/admin/social/social-maintenance";

export const metadata: Metadata = { title: "Social downloader" };
export const dynamic = "force-dynamic";

const TERMINAL_OK = "COMPLETED";

export default async function SocialDownloaderPage() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Grouped queries rather than per-platform round trips.
  const [total, byStatus, byPlatform, recentTotal, bytes, topErrors] = await Promise.all([
    db.socialDownloadJob.count(),
    db.socialDownloadJob.groupBy({ by: ["status"], _count: { _all: true } }),
    db.socialDownloadJob.groupBy({
      by: ["platform", "status"],
      _count: { _all: true },
    }),
    db.socialDownloadJob.count({ where: { createdAt: { gte: since } } }),
    db.socialDownloadJob.aggregate({
      _sum: { fileSize: true },
      where: { status: TERMINAL_OK },
    }),
    db.socialDownloadJob.groupBy({
      by: ["errorCode"],
      where: { status: "FAILED", errorCode: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { errorCode: "desc" } },
      take: 6,
    }),
  ]);

  const statusCount = new Map(byStatus.map((s) => [s.status, s._count._all]));
  const completed = statusCount.get("COMPLETED") ?? 0;
  const failed = statusCount.get("FAILED") ?? 0;
  const active = (statusCount.get("QUEUED") ?? 0) + (statusCount.get("PROCESSING") ?? 0);
  const finished = completed + failed;
  const successRate = finished > 0 ? Math.round((completed / finished) * 100) : null;

  const perPlatform = PLATFORMS.map((p: Platform) => {
    const rows = byPlatform.filter((r) => r.platform === p);
    const done = rows.find((r) => r.status === "COMPLETED")?._count._all ?? 0;
    const bad = rows.find((r) => r.status === "FAILED")?._count._all ?? 0;
    const all = rows.reduce((n, r) => n + r._count._all, 0);
    return {
      platform: p,
      label: PLATFORM_LABELS[p],
      total: all,
      completed: done,
      failed: bad,
      rate: done + bad > 0 ? Math.round((done / (done + bad)) * 100) : null,
    };
  });

  const totalGb = (bytes._sum.fileSize ?? 0) / (1024 * 1024 * 1024);

  const cards = [
    { label: "Total jobs", value: total.toLocaleString(), sub: `${recentTotal.toLocaleString()} in the last 30 days`, icon: CloudDownload },
    { label: "Completed", value: completed.toLocaleString(), sub: successRate === null ? "No finished jobs yet" : `${successRate}% success rate`, icon: CheckCircle2 },
    { label: "Failed", value: failed.toLocaleString(), sub: "Excludes cancelled and expired", icon: XCircle },
    { label: "In flight", value: active.toLocaleString(), sub: "Queued or processing right now", icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, sub, icon: Icon }) => (
          <div
            key={label}
            className="rounded-card border border-border bg-card p-5 shadow-soft transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-elevated"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{label}</p>
              <span className="flex h-9 w-9 items-center justify-center rounded-nested bg-gradient-to-br from-accent to-primary text-white shadow-sm shadow-primary/30">
                <Icon className="h-4.5 w-4.5" aria-hidden />
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-card border border-border bg-card p-5 shadow-soft xl:col-span-2">
          <h2 className="font-semibold">By platform</h2>
          <p className="text-xs text-muted-foreground">
            Success rate counts completed against failed only — cancelled and expired jobs are not
            failures.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
                  <th className="p-2 font-medium">Platform</th>
                  <th className="p-2 text-right font-medium">Total</th>
                  <th className="p-2 text-right font-medium">Completed</th>
                  <th className="p-2 text-right font-medium">Failed</th>
                  <th className="p-2 text-right font-medium">Success</th>
                </tr>
              </thead>
              <tbody>
                {perPlatform.map((p) => (
                  <tr key={p.platform} className="border-b border-border/60 last:border-0">
                    <td className="p-2 font-medium">{p.label}</td>
                    <td className="p-2 text-right tabular-nums">{p.total}</td>
                    <td className="p-2 text-right tabular-nums">{p.completed}</td>
                    <td className="p-2 text-right tabular-nums">{p.failed}</td>
                    <td className="p-2 text-right tabular-nums">
                      {p.rate === null ? "—" : `${p.rate}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-card border border-border bg-card p-5 shadow-soft">
            <h2 className="font-semibold">Delivered</h2>
            <p className="mt-3 text-2xl font-bold tabular-nums">{totalGb.toFixed(2)} GB</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Total size of every completed download.
            </p>
          </div>

          <div className="rounded-card border border-border bg-card p-5 shadow-soft">
            <h2 className="font-semibold">Most common failures</h2>
            {topErrors.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No failures recorded.</p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-sm">
                {topErrors.map((e) => (
                  <li key={e.errorCode} className="flex items-center justify-between gap-3">
                    <span className="truncate font-mono text-xs">{e.errorCode}</span>
                    <span className="tabular-nums text-muted-foreground">{e._count._all}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <SocialMaintenance />
    </div>
  );
}
