"use client";

import * as React from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, Loader2, Pencil, Reply, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { RequestCommentDTO } from "@/lib/request-shared";
import { parseMessageSegments } from "@/lib/chat-shared";
import {
  createRequestCommentAction,
  editRequestCommentAction,
  deleteRequestCommentAction,
  toggleRequestCommentReactionAction,
} from "@/server/actions/request-comments";
import { safeAction } from "@/lib/safe-action";
import { CommentForm } from "@/components/site/comments/comment-form";
import { EmojiReactionPicker } from "@/components/site/chat/emoji-reaction-picker";
import { ReportButton } from "@/components/site/report-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ReplyAction =
  | { type: "add"; reply: RequestCommentDTO }
  | { type: "update"; id: string; body: string }
  | { type: "remove"; id: string };

function reduceReplies(state: RequestCommentDTO[], action: ReplyAction): RequestCommentDTO[] {
  switch (action.type) {
    case "add":
      return [...state, action.reply];
    case "update":
      return state.map((r) => (r.id === action.id ? { ...r, body: action.body, editedAt: new Date().toISOString() } : r));
    case "remove":
      return state.filter((r) => r.id !== action.id);
  }
}

function Avatar({ author, size = 32 }: { author: RequestCommentDTO["author"]; size?: number }) {
  if (author.isAdmin) {
    return (
      <span
        aria-hidden
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-primary text-white shadow-sm shadow-primary/30"
      >
        <ShieldCheck className="h-4 w-4" />
      </span>
    );
  }
  if (author.image) {
    return (
      <Image src={author.image} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" unoptimized />
    );
  }
  const initials = author.label
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
    >
      {initials || "?"}
    </span>
  );
}

function CommentBody({ body, isReply }: { body: string; isReply: boolean }) {
  const segments = React.useMemo(() => parseMessageSegments(body), [body]);
  return (
    <p className={cn("mt-0.5 text-sm break-words whitespace-pre-wrap text-foreground/90", isReply && "text-[13px]")}>
      {segments.map((segment, i) =>
        segment.type === "text" ? (
          <React.Fragment key={i}>{segment.text}</React.Fragment>
        ) : (
          <span key={i} className="font-medium text-primary">
            @user
          </span>
        )
      )}
    </p>
  );
}

export function RequestCommentItem({
  comment,
  requestId,
  isReply = false,
  onEdited,
  onDeleted,
  pending = false,
}: {
  comment: RequestCommentDTO;
  requestId: string;
  isReply?: boolean;
  onEdited: (id: string, body: string) => Promise<{ ok: boolean; error?: string }>;
  onDeleted: (id: string) => Promise<{ ok: boolean; error?: string }>;
  pending?: boolean;
}) {
  const { data: session } = useSession();
  const isOwn = session?.user?.id !== undefined && comment.mine;
  const isDeleted = comment.status === "DELETED";

  const [reactions, setReactions] = React.useState(comment.reactions);
  const [reactBusy, setReactBusy] = React.useState(false);
  const [replying, setReplying] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [editBody, setEditBody] = React.useState(comment.body);
  const [editBusy, setEditBusy] = React.useState(false);
  const [deleteBusy, setDeleteBusy] = React.useState(false);

  const [repliesOpen, setRepliesOpen] = React.useState(false);
  const [replies, setReplies] = React.useState<RequestCommentDTO[]>([]);
  const [repliesLoaded, setRepliesLoaded] = React.useState(false);
  const [repliesLoading, setRepliesLoading] = React.useState(false);
  const [, startReplyTransition] = React.useTransition();
  const [optimisticReplies, addOptimisticReply] = React.useOptimistic(replies, reduceReplies);

  async function loadReplies() {
    setRepliesLoading(true);
    try {
      const qs = new URLSearchParams({ parentId: comment.id });
      const res = await fetch(`/api/course-requests/comments?${qs.toString()}`);
      const data = (await res.json()) as { items: RequestCommentDTO[] };
      setReplies(data.items);
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
        const optimisticReply: RequestCommentDTO = {
          id: `temp-${Math.random().toString(36).slice(2)}`,
          requestId,
          parentId: comment.id,
          body,
          status: "VISIBLE",
          createdAt: new Date().toISOString(),
          editedAt: null,
          author: { label: session.user.name ?? "You", image: session.user.image ?? null, isAdmin: false },
          mine: true,
          reactions: [],
          replyCount: 0,
        };
        addOptimisticReply({ type: "add", reply: optimisticReply });

        const result = await safeAction(() => createRequestCommentAction({ requestId, parentId: comment.id, body }), "reply to request comment");
        if (!result.ok) {
          resolve({ ok: false, error: result.error });
          return;
        }
        if (result.comment && result.comment.status === "VISIBLE") {
          setReplies((prev) => [...prev, result.comment!]);
        } else {
          toast.info("Your reply was submitted and is pending review.");
        }
        setRepliesOpen(true);
        setRepliesLoaded(true);
        resolve({ ok: true });
      });
    });
  }

  /** Operates on THIS component's own local `replies`, never the parent's — same rule as CommentItem's submitEditReply. */
  function submitEditReply(id: string, body: string): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      startReplyTransition(async () => {
        addOptimisticReply({ type: "update", id, body });
        const result = await safeAction(() => editRequestCommentAction(id, body), "edit request comment");
        if (!result.ok) {
          resolve({ ok: false, error: result.error });
          return;
        }
        if (result.comment) setReplies((prev) => prev.map((r) => (r.id === id ? result.comment! : r)));
        resolve({ ok: true });
      });
    });
  }

  function submitDeleteReply(id: string): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      startReplyTransition(async () => {
        addOptimisticReply({ type: "remove", id });
        const result = await safeAction(() => deleteRequestCommentAction(id), "delete request comment");
        if (!result.ok) {
          resolve({ ok: false, error: result.error });
          return;
        }
        setReplies((prev) => prev.filter((r) => r.id !== id));
        resolve({ ok: true });
      });
    });
  }

  async function onReact(emoji: string) {
    if (!session?.user) {
      toast.error("Sign in to react to comments.");
      return;
    }
    if (reactBusy) return;
    setReactBusy(true);
    const existing = reactions.find((r) => r.emoji === emoji);
    const optimistic = existing
      ? existing.reactedByMe
        ? reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, reactedByMe: false } : r)).filter((r) => r.count > 0)
        : reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, reactedByMe: true } : r))
      : [...reactions, { emoji, count: 1, reactedByMe: true }];
    setReactions(optimistic);
    try {
      const result = await safeAction(() => toggleRequestCommentReactionAction({ commentId: comment.id, emoji }), "toggle request comment reaction");
      if (!result.ok) {
        setReactions(comment.reactions);
        toast.error(result.error);
      }
    } finally {
      setReactBusy(false);
    }
  }

  async function onSaveEdit() {
    if (!editBody.trim() || editBusy) return;
    setEditBusy(true);
    try {
      const result = await onEdited(comment.id, editBody);
      if (result.ok) setEditing(false);
      else toast.error(result.error);
    } finally {
      setEditBusy(false);
    }
  }

  async function onDeleteClick() {
    if (deleteBusy) return;
    if (!window.confirm("Delete this comment?")) return;
    setDeleteBusy(true);
    try {
      const result = await onDeleted(comment.id);
      if (result.ok) toast.success("Comment deleted");
      else toast.error(result.error);
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className={cn("flex gap-3", isReply && "pl-10", pending && "opacity-70")}>
      <Avatar author={comment.author} size={isReply ? 28 : 36} />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-muted/50 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold">{isDeleted ? "Deleted" : comment.author.label}</span>
            {comment.author.isAdmin && (
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-primary uppercase ring-1 ring-primary/15 ring-inset">
                Admin
              </span>
            )}
          </div>

          {isDeleted ? (
            <p className="mt-0.5 text-sm text-muted-foreground italic">This comment was deleted.</p>
          ) : editing ? (
            <div className="mt-1.5 space-y-2">
              <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={2} maxLength={10_000} autoFocus />
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
            <CommentBody body={comment.body} isReply={isReply} />
          )}
        </div>

        {!isDeleted && !editing && (
          <div className="mt-1 flex flex-wrap items-center gap-3 px-2 text-xs text-muted-foreground">
            <span suppressHydrationWarning>{formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}</span>
            {comment.editedAt && <span>(edited)</span>}
            {!isReply && (
              <button
                type="button"
                onClick={() => setReplying((r) => !r)}
                className="inline-flex cursor-pointer items-center gap-1 hover:text-primary"
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
                  className="inline-flex cursor-pointer items-center gap-1 hover:text-primary"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void onDeleteClick()}
                  disabled={deleteBusy}
                  className="inline-flex cursor-pointer items-center gap-1 hover:text-destructive disabled:opacity-60"
                >
                  {deleteBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
                  Delete
                </button>
              </>
            ) : (
              <ReportButton target={{ requestCommentId: comment.id }} />
            )}
          </div>
        )}

        {!isDeleted && !editing && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1 px-2">
            {reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => void onReact(r.emoji)}
                disabled={reactBusy}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors",
                  r.reactedByMe ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                <span>{r.emoji}</span>
                <span className="tabular-nums">{r.count}</span>
              </button>
            ))}
            <EmojiReactionPicker onPick={(emoji) => void onReact(emoji)} />
          </div>
        )}

        {replying && !isReply && (
          <div className="mt-2 pl-1">
            <CommentForm
              parentId={comment.id}
              submitLabel="Post reply"
              placeholder="Write a reply…"
              autoFocus
              onSubmit={submitReply}
              onCancel={() => setReplying(false)}
            />
          </div>
        )}

        {!isReply && comment.replyCount > 0 && (
          <button
            type="button"
            onClick={toggleReplies}
            className="mt-2 inline-flex cursor-pointer items-center gap-1 pl-1 text-xs font-medium text-primary hover:underline"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", repliesOpen && "rotate-180")} aria-hidden />
            {repliesOpen ? "Hide" : "Show"} {comment.replyCount} {comment.replyCount === 1 ? "reply" : "replies"}
          </button>
        )}

        {!isReply && repliesOpen && (
          <div className="mt-3 space-y-3">
            {repliesLoading && optimisticReplies.length === 0 ? (
              <Loader2 className="ml-10 h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              optimisticReplies.map((reply) => (
                <RequestCommentItem
                  key={reply.id}
                  comment={reply}
                  requestId={requestId}
                  isReply
                  onEdited={submitEditReply}
                  onDeleted={submitDeleteReply}
                  pending={reply.id.startsWith("temp-")}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
