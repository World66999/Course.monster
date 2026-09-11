import { formatDistanceToNow } from "date-fns";
import type { ReviewWithAuthor } from "@/lib/comments";
import { AuthorAvatar, VerifiedBadge } from "@/components/site/comments/author-avatar";
import { StarDisplay } from "@/components/site/reviews/stars";
import { ReportButton } from "@/components/site/report-dialog";

export function ReviewItem({
  review,
  isOwn,
}: {
  review: ReviewWithAuthor;
  isOwn: boolean;
}) {
  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <AuthorAvatar author={review.user} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-medium">{review.user.name}</span>
            <VerifiedBadge author={review.user} />
            {isOwn && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                Your review
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <StarDisplay rating={review.rating} />
            <span suppressHydrationWarning>{formatDistanceToNow(review.createdAt, { addSuffix: true })}</span>
          </div>
        </div>
        {!isOwn && <ReportButton target={{ reviewId: review.id }} />}
      </div>
      {review.title && <p className="mt-3 font-semibold">{review.title}</p>}
      <p className="mt-1.5 text-sm break-words whitespace-pre-wrap text-foreground/90">{review.body}</p>
    </div>
  );
}
