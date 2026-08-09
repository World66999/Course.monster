import type { ReviewSummary } from "@/lib/comments";
import { StarDisplay } from "@/components/site/reviews/stars";

export function ReviewSummaryCard({ summary }: { summary: ReviewSummary }) {
  if (summary.reviewCount === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
        <p className="text-sm text-muted-foreground">No reviews yet — be the first to review this course.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 rounded-2xl border border-border bg-card p-6 shadow-soft sm:grid-cols-[auto_1fr]">
      <div className="flex flex-col items-center justify-center gap-1 sm:pr-6 sm:border-r sm:border-border">
        <p className="text-4xl font-extrabold tabular-nums">{summary.avgRating.toFixed(1)}</p>
        <StarDisplay rating={summary.avgRating} />
        <p className="text-xs text-muted-foreground">
          {summary.reviewCount} review{summary.reviewCount === 1 ? "" : "s"}
        </p>
      </div>
      <div className="space-y-1.5">
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const count = summary.breakdown[star];
          const pct = summary.reviewCount > 0 ? Math.round((count / summary.reviewCount) * 100) : 0;
          return (
            <div key={star} className="flex items-center gap-2 text-xs">
              <span className="w-8 shrink-0 text-muted-foreground">{star}★</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-warning" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
