"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Lock, MessageSquare } from "lucide-react";
import type { RequestCommentDTO } from "@/lib/request-shared";
import {
  createRequestCommentAction,
  editRequestCommentAction,
  deleteRequestCommentAction,
} from "@/server/actions/request-comments";
import { safeAction } from "@/lib/safe-action";
import { RequestCommentItem } from "@/components/site/requests/request-comment-item";
import { CommentForm } from "@/components/site/comments/comment-form";
import { SignInGate } from "@/components/site/sign-in-gate";
import { EmptyState } from "@/components/site/section";

type OptimisticAction =
  | { type: "add"; comment: RequestCommentDTO }
  | { type: "update"; id: string; body: string }
  | { type: "remove"; id: string };

function reduceOptimistic(state: RequestCommentDTO[], action: OptimisticAction): RequestCommentDTO[] {
  switch (action.type) {
    case "add":
      return [action.comment, ...state];
    case "update":
      return state.map((c) => (c.id === action.id ? { ...c, body: action.body, editedAt: new Date().toISOString() } : c));
    case "remove":
      return state.filter((c) => c.id !== action.id);
  }
}

export function RequestCommentsSection({
  requestId,
  initialItems,
  initialCommentCount,
  commentsLocked,
}: {
  requestId: string;
  initialItems: RequestCommentDTO[];
  initialCommentCount: number;
  commentsLocked: boolean;
}) {
  const { data: session } = useSession();
  const [items, setItems] = React.useState(initialItems);
  const [totalCount, setTotalCount] = React.useState(initialCommentCount);
  const [isPending, startTransition] = React.useTransition();
  const [optimisticItems, addOptimistic] = React.useOptimistic(items, reduceOptimistic);

  function submitComment(body: string): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      startTransition(async () => {
        if (!session?.user) {
          resolve({ ok: false, error: "Sign in to comment." });
          return;
        }
        const optimisticComment: RequestCommentDTO = {
          id: `temp-${Math.random().toString(36).slice(2)}`,
          requestId,
          parentId: null,
          body,
          status: "VISIBLE",
          createdAt: new Date().toISOString(),
          editedAt: null,
          author: { label: session.user.name ?? "You", image: session.user.image ?? null, isAdmin: false },
          mine: true,
          reactions: [],
          replyCount: 0,
        };
        addOptimistic({ type: "add", comment: optimisticComment });

        const result = await safeAction(() => createRequestCommentAction({ requestId, body }), "post request comment");
        if (!result.ok) {
          resolve({ ok: false, error: result.error });
          return;
        }
        if (result.comment && result.comment.status === "VISIBLE") {
          setItems((prev) => [result.comment!, ...prev]);
          setTotalCount((c) => c + 1);
        } else {
          toast.info("Your comment was submitted and is pending review.");
        }
        resolve({ ok: true });
      });
    });
  }

  function submitEdit(id: string, body: string): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      startTransition(async () => {
        addOptimistic({ type: "update", id, body });
        const result = await safeAction(() => editRequestCommentAction(id, body), "edit request comment");
        if (!result.ok) {
          resolve({ ok: false, error: result.error });
          return;
        }
        if (result.comment) setItems((prev) => prev.map((c) => (c.id === id ? result.comment! : c)));
        resolve({ ok: true });
      });
    });
  }

  function submitDelete(id: string): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      startTransition(async () => {
        addOptimistic({ type: "remove", id });
        const result = await safeAction(() => deleteRequestCommentAction(id), "delete request comment");
        if (!result.ok) {
          resolve({ ok: false, error: result.error });
          return;
        }
        setItems((prev) => prev.filter((c) => c.id !== id));
        setTotalCount((c) => Math.max(0, c - 1));
        resolve({ ok: true });
      });
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MessageSquare className="h-5 w-5" aria-hidden />
          {totalCount} comment{totalCount === 1 ? "" : "s"}
        </h2>
      </div>

      {commentsLocked ? (
        <div className="flex items-center gap-2 rounded-nested border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" aria-hidden />
          Comments are locked on this request.
        </div>
      ) : (
        <SignInGate prompt="Sign in to join the discussion.">
          <CommentForm submitLabel="Post comment" placeholder="Share your thoughts…" onSubmit={submitComment} />
        </SignInGate>
      )}

      {optimisticItems.length === 0 ? (
        <EmptyState icon={<MessageSquare aria-hidden />} title="No comments yet" description="Be the first to weigh in." />
      ) : (
        <div className="space-y-5">
          {optimisticItems.map((comment) => (
            <RequestCommentItem
              key={comment.id}
              comment={comment}
              requestId={requestId}
              onEdited={submitEdit}
              onDeleted={submitDelete}
              pending={comment.id.startsWith("temp-") && isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
