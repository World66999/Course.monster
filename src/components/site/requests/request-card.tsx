"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "date-fns";
import { ArrowBigUp, Bookmark, MessageSquare, User } from "lucide-react";
import { toast } from "sonner";
import { toggleRequestVoteAction, toggleRequestBookmarkAction } from "@/server/actions/course-requests";
import type { RequestCardDTO } from "@/lib/request-shared";
import { RequestStatusBadge, PopularBadge, RequestKindBadge } from "@/components/site/requests/status-badge";
import { CourseImage } from "@/components/site/course-image";
import { cn, formatNumber } from "@/lib/utils";

export function RequestCard({ request }: { request: RequestCardDTO }) {
  const { data: session } = useSession();
  const [voted, setVoted] = React.useState(request.votedByMe);
  const [voteCount, setVoteCount] = React.useState(request.voteCount);
  const [bookmarked, setBookmarked] = React.useState(request.bookmarkedByMe);
  const [voteBusy, setVoteBusy] = React.useState(false);
  const [bookmarkBusy, setBookmarkBusy] = React.useState(false);

  async function onVote(e: React.MouseEvent) {
    e.preventDefault();
    if (!session?.user) {
      toast.error("Sign in to vote for requests.");
      return;
    }
    if (voteBusy) return;
    setVoteBusy(true);
    const next = !voted;
    setVoted(next);
    setVoteCount((c) => c + (next ? 1 : -1));
    try {
      const result = await toggleRequestVoteAction(request.id);
      if (!result.ok) {
        setVoted(!next);
        setVoteCount((c) => c + (next ? -1 : 1));
        toast.error(result.error);
      } else if (typeof result.voteCount === "number") {
        setVoteCount(result.voteCount);
      }
    } finally {
      setVoteBusy(false);
    }
  }

  async function onBookmark(e: React.MouseEvent) {
    e.preventDefault();
    if (!session?.user) {
      toast.error("Sign in to bookmark requests.");
      return;
    }
    if (bookmarkBusy) return;
    setBookmarkBusy(true);
    const next = !bookmarked;
    setBookmarked(next);
    try {
      const result = await toggleRequestBookmarkAction(request.id);
      if (!result.ok) {
        setBookmarked(!next);
        toast.error(result.error);
      }
    } finally {
      setBookmarkBusy(false);
    }
  }

  return (
    <Link
      href={`/requests/${request.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-elevated"
    >
      {request.imageThumbUrl && (
        <div className="relative aspect-[16/9] overflow-hidden bg-muted">
          <CourseImage
            src={request.imageThumbUrl}
            title={request.title}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <RequestKindBadge kind={request.kind} />
          <RequestStatusBadge status={request.status} />
          {request.isPopular && <PopularBadge />}
          {request.featured && <span className="text-xs font-semibold text-primary uppercase">Featured</span>}
        </div>

        <h3 className="line-clamp-2 leading-snug font-semibold text-card-foreground transition-colors duration-200 group-hover:text-primary">
          {request.title}
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{request.description}</p>

        {request.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {request.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{request.author.label}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0" suppressHydrationWarning>{formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5" role="group" aria-label="Request actions">
          <button
            type="button"
            onClick={(e) => void onVote(e)}
            aria-pressed={voted}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              voted
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            )}
          >
            <ArrowBigUp className={cn("h-3.5 w-3.5", voted && "fill-primary")} aria-hidden />
            <span className="tabular-nums">{formatNumber(voteCount)}</span>
          </button>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
            {formatNumber(request.commentCount)}
          </span>
          <button
            type="button"
            onClick={(e) => void onBookmark(e)}
            aria-pressed={bookmarked}
            aria-label={bookmarked ? "Remove bookmark" : "Bookmark this request"}
            className={cn(
              "ml-auto inline-flex cursor-pointer items-center justify-center rounded-full border p-1.5 transition-colors",
              bookmarked
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            )}
          >
            <Bookmark className={cn("h-3.5 w-3.5", bookmarked && "fill-primary")} aria-hidden />
          </button>
        </div>
      </div>
    </Link>
  );
}
