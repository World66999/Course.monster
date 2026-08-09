import Link from "next/link";
import { Award, Bell, Bookmark, CheckCircle2, Lightbulb, ThumbsUp } from "lucide-react";
import type { UserRequestStats } from "@/lib/course-requests";

const STATS: { key: keyof UserRequestStats; label: string; icon: React.ComponentType<{ className?: string }>; href: string }[] = [
  { key: "createdCount", label: "Requests created", icon: Lightbulb, href: "/requests?mine=true" },
  { key: "resolvedCount", label: "Resolved", icon: CheckCircle2, href: "/requests?mine=true&status=RESOLVED" },
  { key: "votedCount", label: "Votes cast", icon: ThumbsUp, href: "/requests" },
  { key: "bookmarkedCount", label: "Bookmarked", icon: Bookmark, href: "/requests?bookmarked=true" },
  { key: "followingCount", label: "Following", icon: Bell, href: "/requests?following=true" },
];

export function RequestActivitySection({ stats }: { stats: UserRequestStats }) {
  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Course Requests activity</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
          <Award className="h-4 w-4" aria-hidden />
          {stats.reputation} reputation
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {STATS.map(({ key, label, icon: Icon, href }) => (
          <Link
            key={key}
            href={href}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-muted/30 p-4 text-center transition-colors hover:bg-muted/60"
          >
            <Icon className="h-5 w-5 text-primary" aria-hidden />
            <span className="text-xl font-bold tabular-nums">{stats[key]}</span>
            <span className="text-xs text-muted-foreground">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
