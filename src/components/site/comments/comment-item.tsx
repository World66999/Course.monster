"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, Heart, Loader2, Pencil, Reply, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { CommentWithMeta } from "@/lib/comments";
import { createCommentAction, editCommentAction, deleteCommentAction, toggleCommentLikeAction } from "@/server/actions/comments";
import { safeAction } from "@/lib/safe-action";
import { AuthorAvatar, AuthorPremiumBadge, VerifiedBadge } from "@/components/site/comments/author-avatar";
import { CommentForm } from "@/components/site/comments/comment-form";
import { ReportButton } from "@/components/site/report-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ReplyAction =
  | { type: "add"; reply: CommentWithMeta }
  | { type: "update"; id: string; body: string }
  | { type: "remove"; id: string };

function reduceReplies(state: CommentWithMeta[], action: ReplyAction): CommentWithMeta[] {
  switch (action.type) {
    case "add":
      return [...state, action.reply];
    case "update":
      return state.map((r) => (r.id === action.id ? { ...r, body: action.body, editedAt: new Date() } : r));
    case "remove":
      return state.filter((r) => r.id !== action.id);
  }
}

/**
 * Like / Reply / Edit / Delete under a comment. These are 16px-tall text
 * buttons — right for the visual weight they should carry, and genuinely hard to
 * hit with a thumb, so `tap-target` extends each one's reach to 44px on a coarse
 * pointer. The row is `gap-3`, and the boxes only grow past the label where the
 * label is under 44px wide, so no button can capture its neighbour's tap.
 */
const ACTION_BUTTON = "tap-target inline-flex cursor-pointer items-center gap-1 hover:text-primary";

export function CommentItem({
  comment,
  courseId,
  isReply = false,
  onEdit,
  onDelete,
  pending = false,
}: {
  comment: CommentWithMeta;
  courseId: string;
  isReply?: boolean;
  onEdit: (id: string, body: string) => Promise<{ ok: boolean; error?: string }>;
  onDelete: (id: string) => Promise<{ ok: boolean; error?: string }>;
  pending?: boolean;
}) {
  const { data: session } = useSession();
  const isOwn = session?.user?.id === comment.user.id;
  const isDeleted = comment.status === "DELETED";

  const [liked, setLiked] = React.useState(comment.likedByMe);
  const [likeCount, setLikeCount] = React.useState(comment.likeCount);
  const [likeBusy, setLikeBusy] = React.useState(false);
  const [replying, setReplying] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [editBody, setEditBody] = React.useState(comment.body);
  const [editBusy, setEditBusy] = React.useState(false);

  const [repliesOpen, setRepliesOpen] = React.useState(false);
  const [replies, setReplies] = React.useState<CommentWithMeta[]>([]);
  const [repliesCursor, setRepliesCursor] = React.useState<string | null>(null);
  const [repliesLoaded, setRepliesLoaded] = React.useState(false);
  const [repliesLoading, setRepliesLoading] = React.useState(false);
  const [, startReplyTransition] = React.useTransition();
  const [optimisticReplies, addOptimisticReply] = React.useOptimistic(replies, reduceReplies);

  async function loadReplies(cursor?: string | null) {
    setRepliesLoading(true);
    try {
      const qs = new URLSearchParams({ parentId: comment.id });
      if (cursor) qs.set("cursor", cursor);
      const res = await fetch(`/api/comments?${qs.toString()}`);
      const data = (await res.json()) as { items: CommentWithMeta[]; nextCursor: string | null };
      setReplies((prev) => (cursor ? [...prev, ...data.items] : data.items));
      setRepliesCursor(data.nextCursor);
      setRepliesLoaded(true);
    } finally {
      setRepliesLoading(false);
    }
  }

  function toggleReplies() {
    const next = !repliesOpen;
    setRepliesOpen(next);
    if (next && !repliesLoaded) void loadReplies();
  }

  function submitReply(body: string): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      startReplyTransition(async () => {
        if (!session?.user) {
          resolve({ ok: false, error: "Sign in to reply." });
          return;
        }
        const optimisticReply: CommentWithMeta = {
          id: `temp-${Math.random().toString(36).slice(2)}`,
          courseId,
          parentId: comment.id,
          body,
          status: "VISIBLE",
          likeCount: 0,
          createdAt: new Date(),
          editedAt: null,
          user: {
            id: session.user.id,
            name: session.user.name ?? "You",
            image: session.user.image ?? null,
            accounts: [],
            subscriptions: [],
          },
          _count: { replies: 0 },
          likedByMe: false,
        };
        addOptimisticReply({ type: "add", reply: optimisticReply });

        const result = await safeAction(() => createCommentAction({ courseId, parentId: comment.id, body }), "reply to comment");
        if (!result.ok) {
          resolve({ ok: false, error: result.error });
          return;
        }
        if (result.comment && result.comment.status === "VISIBLE") {
          setReplies((prev) => [...prev, { ...result.comment!, likedByMe: false }]);
        } else {
          toast.info("Your reply was submitted and is pending review.");
        }
        setRepliesOpen(true);
        setRepliesLoaded(true);
        resolve({ ok: true });
      });
    });
  }

  /**
   * Edit/delete for one of THIS comment's own replies — must operate on
   * this component's local `replies` state, not the top-level `items` list
   * CommentThread owns (which never contains replies). Passed to the
   * nested <CommentItem> instances below instead of forwarding the onEdit/
   * onDelete props this component itself received from its own parent.
   */
  function submitEditReply(id: string, body: string): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      startReplyTransition(async () => {
        addOptimisticReply({ type: "update", id, body });
        const result = await safeAction(() => editCommentAction(id, body), "edit comment");
        if (!result.ok) {
          resolve({ ok: false, error: result.error });
          return;
        }
        if (result.comment) {
          setReplies((prev) =>
            prev.map((r) => (r.id === id ? { ...result.comment!, likedByMe: r.likedByMe } : r))
          );
        }
        resolve({ ok: true });
      });
    });
  }

  function submitDeleteReply(id: string): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      startReplyTransition(async () => {
        addOptimisticReply({ type: "remove", id });
        const result = await safeAction(() => deleteCommentAction(id), "delete comment");
        if (!result.ok) {
          resolve({ ok: false, error: result.error });
          return;
        }
        setReplies((prev) => prev.filter((r) => r.id !== id));
        resolve({ ok: true });
      });
    });
  }

  async function onToggleLike() {
    if (!session?.user) {
      toast.error("Sign in with Google to like comments.");
      return;
    }
    if (likeBusy) return;
    setLikeBusy(true);
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((c) => c + (nextLiked ? 1 : -1));
    try {
      const result = await safeAction(() => toggleCommentLikeAction(comment.id), "toggle comment like");
      if (!result.ok) {
        // Revert on failure.
        setLiked(!nextLiked);
        setLikeCount((c) => c + (nextLiked ? -1 : 1));
        toast.error(result.error);
      } else if (typeof result.likeCount === "number") {
        setLikeCount(result.likeCount);
      }
    } finally {
      setLikeBusy(false);
    }
  }

  async function onSaveEdit() {
    if (!editBody.trim() || editBusy) return;
    setEditBusy(true);
    try {
      const result = await onEdit(comment.id, editBody);
      if (result.ok) {
        setEditing(false);
      } else {
        toast.error(result.error);
      }
    } finally {
      setEditBusy(false);
    }
  }

  async function onDeleteClick() {
    if (!window.confirm("Delete this comment?")) return;
    const result = await onDelete(comment.id);
    if (result.ok) {
      toast.success("Comment deleted");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className={cn("flex gap-3", isReply && "pl-10", pending && "opacity-70")}>
      <AuthorAvatar author={comment.user} size={isReply ? 28 : 36} />
      <div className="min-w-0 flex-1">
        <div className="rounded-card bg-muted/50 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold">{isDeleted ? "Deleted" : comment.user.name}</span>
            {!isDeleted && <VerifiedBadge author={comment.user} />}
            {!isDeleted && <AuthorPremiumBadge author={comment.user} />}
          </div>
          {isDeleted ? (
            <p className="mt-0.5 text-sm text-muted-foreground italic">[deleted]</p>
          ) : editing ? (
            <div className="mt-1.5 space-y-2">
              <Textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={2}
                maxLength={10_000}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button type="button" size="sm" disabled={editBusy} onClick={onSaveEdit}>
                  {editBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-0.5 text-sm break-words whitespace-pre-wrap text-foreground/90">{comment.body}</p>
          )}
        </div>

        {!isDeleted && !editing && (
          <div className="mt-1 flex flex-wrap items-center gap-3 px-2 text-xs text-muted-foreground">
            <span suppressHydrationWarning>{pending ? "Posting…" : formatDistanceToNow(comment.createdAt, { addSuffix: true })}</span>
            {comment.editedAt && <span>(edited)</span>}
            <button
              type="button"
              onClick={() => void onToggleLike()}
              aria-pressed={liked}
              className={cn(ACTION_BUTTON, liked && "text-primary")}
            >
              <Heart className={cn("h-3.5 w-3.5", liked && "fill-primary")} aria-hidden />
              {likeCount > 0 ? likeCount : "Like"}
            </button>
            {!isReply && (
              <button
                type="button"
                onClick={() => setReplying((v) => !v)}
                className={ACTION_BUTTON}
              >
                <Reply className="h-3.5 w-3.5" aria-hidden />
                Reply
              </button>
            )}
            {isOwn ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditBody(comment.body);
                    setEditing(true);
                  }}
                  className={ACTION_BUTTON}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void onDeleteClick()}
                  className={cn(ACTION_BUTTON, "hover:text-destructive")}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Delete
                </button>
              </>
            ) : (
              <ReportButton target={{ commentId: comment.id }} />
            )}
          </div>
        )}

        {replying && (
          <div className="mt-2">
            <CommentForm
              parentId={comment.id}
              submitLabel="Reply"
              placeholder="Write a reply…"
              autoFocus
              onCancel={() => setReplying(false)}
              onSubmit={async (body) => {
                const result = await submitReply(body);
                if (result.ok) setReplying(false);
                return result;
              }}
            />
          </div>
        )}

        {!isReply && comment._count.replies > 0 && (
          <button
            type="button"
            onClick={toggleReplies}
            className="mt-1.5 ml-2 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", repliesOpen && "rotate-180")} aria-hidden />
            {repliesOpen ? "Hide" : "View"} {comment._count.replies} repl{comment._count.replies === 1 ? "y" : "ies"}
          </button>
        )}

        {repliesOpen && (
          <div className="mt-3 space-y-3">
            {optimisticReplies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                courseId={courseId}
                isReply
                onEdit={submitEditReply}
                onDelete={submitDeleteReply}
                pending={reply.id.startsWith("temp-")}
              />
            ))}
            {repliesLoading && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
              </div>
            )}
            {repliesCursor && !repliesLoading && (
              <button
                type="button"
                onClick={() => void loadReplies(repliesCursor)}
                className="ml-10 text-xs font-medium text-primary hover:underline"
              >
                Load more replies
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
