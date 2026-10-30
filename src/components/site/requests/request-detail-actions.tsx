"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowBigUp, Bell, BellOff, Bookmark, Loader2, Pencil, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import {
  toggleRequestVoteAction,
  toggleRequestBookmarkAction,
  toggleRequestFollowAction,
  deleteCourseRequestAction,
} from "@/server/actions/course-requests";
import { safeAction } from "@/lib/safe-action";
import { ReportButton } from "@/components/site/report-dialog";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function RequestDetailActions({
  requestId,
  slug,
  mine,
  initialVoted,
  initialVoteCount,
  initialBookmarked,
  initialFollowed,
}: {
  requestId: string;
  slug: string;
  mine: boolean;
  initialVoted: boolean;
  initialVoteCount: number;
  initialBookmarked: boolean;
  initialFollowed: boolean;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const [voted, setVoted] = React.useState(initialVoted);
  const [voteCount, setVoteCount] = React.useState(initialVoteCount);
  const [bookmarked, setBookmarked] = React.useState(initialBookmarked);
  const [followed, setFollowed] = React.useState(initialFollowed);
  const [voteBusy, setVoteBusy] = React.useState(false);
  const [bookmarkBusy, setBookmarkBusy] = React.useState(false);
  const [followBusy, setFollowBusy] = React.useState(false);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  async function onVote() {
    if (!session?.user) {
      toast.error("Sign in to vote for this request.");
      return;
    }
    if (voteBusy) return;
    setVoteBusy(true);
    const next = !voted;
    setVoted(next);
    setVoteCount((c) => c + (next ? 1 : -1));
    try {
      const result = await safeAction(() => toggleRequestVoteAction(requestId), "toggle request vote");
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

  async function onBookmark() {
    if (!session?.user) {
      toast.error("Sign in to bookmark this request.");
      return;
    }
    if (bookmarkBusy) return;
    setBookmarkBusy(true);
    const next = !bookmarked;
    setBookmarked(next);
    try {
      const result = await safeAction(() => toggleRequestBookmarkAction(requestId), "toggle request bookmark");
      if (!result.ok) {
        setBookmarked(!next);
        toast.error(result.error);
      } else {
        toast.success(next ? "Bookmarked" : "Bookmark removed");
      }
    } finally {
      setBookmarkBusy(false);
    }
  }

  async function onFollow() {
    if (!session?.user) {
      toast.error("Sign in to follow this request.");
      return;
    }
    if (followBusy) return;
    setFollowBusy(true);
    const next = !followed;
    setFollowed(next);
    try {
      const result = await safeAction(() => toggleRequestFollowAction(requestId), "toggle request follow");
      if (!result.ok) {
        setFollowed(!next);
        toast.error(result.error);
      } else {
        toast.success(next ? "You'll be notified about updates" : "Unfollowed");
      }
    } finally {
      setFollowBusy(false);
    }
  }

  async function onShare() {
    const url = `${window.location.origin}/requests/${slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  }

  async function onDelete() {
    if (deleteBusy) return;
    if (!window.confirm("Delete this request? This can't be undone.")) return;
    setDeleteBusy(true);
    try {
      const result = await safeAction(() => deleteCourseRequestAction(requestId), "delete request");
      if (result.ok) {
        toast.success("Request deleted");
        router.push("/requests");
      } else {
        toast.error(result.error);
      }
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void onVote()}
        aria-pressed={voted}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
          voted ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-foreground hover:bg-muted"
        )}
      >
        <ArrowBigUp className={cn("h-4 w-4", voted && "fill-primary")} aria-hidden />
        <span className="tabular-nums">{formatNumber(voteCount)}</span>
        {voted ? "Voted" : "Vote"}
      </button>

      <button
        type="button"
        onClick={() => void onBookmark()}
        aria-pressed={bookmarked}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
          bookmarked ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-foreground hover:bg-muted"
        )}
      >
        <Bookmark className={cn("h-4 w-4", bookmarked && "fill-primary")} aria-hidden />
        {bookmarked ? "Bookmarked" : "Bookmark"}
      </button>

      <button
        type="button"
        onClick={() => void onFollow()}
        aria-pressed={followed}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
          followed ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-foreground hover:bg-muted"
        )}
      >
        {followed ? <Bell className="h-4 w-4 fill-primary" aria-hidden /> : <BellOff className="h-4 w-4" aria-hidden />}
        {followed ? "Following" : "Follow"}
      </button>

      <button
        type="button"
        onClick={() => void onShare()}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
      >
        <Share2 className="h-4 w-4" aria-hidden />
        Share
      </button>

      {mine ? (
        <>
          <Link href={`/requests/${slug}/edit`} className="ml-auto">
            <Button type="button" variant="outline" size="sm">
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Edit
            </Button>
          </Link>
          <Button type="button" variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" disabled={deleteBusy} onClick={() => void onDelete()}>
            {deleteBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
            Delete
          </Button>
        </>
      ) : (
        <div className="ml-auto">
          <ReportButton target={{ courseRequestId: requestId }} />
        </div>
      )}
    </div>
  );
}
