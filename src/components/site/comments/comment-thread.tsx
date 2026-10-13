"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, MessageSquare } from "lucide-react";
import type { CommentSort, CommentWithMeta } from "@/lib/comments";
import { createCommentAction, editCommentAction, deleteCommentAction } from "@/server/actions/comments";
import { safeAction } from "@/lib/safe-action";
import { CommentItem } from "@/components/site/comments/comment-item";
import { CommentForm } from "@/components/site/comments/comment-form";
import { SignInGate } from "@/components/site/sign-in-gate";
import { EmptyState } from "@/components/site/section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SORTS: { value: CommentSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "helpful", label: "Most helpful" },
];

type OptimisticAction =
  | { type: "add"; comment: CommentWithMeta }
  | { type: "update"; id: string; body: string }
  | { type: "remove"; id: string };

function reduceOptimistic(state: CommentWithMeta[], action: OptimisticAction): CommentWithMeta[] {
  switch (action.type) {
    case "add":
      return [action.comment, ...state];
    case "update":
      return state.map((c) => (c.id === action.id ? { ...c, body: action.body, editedAt: new Date() } : c));
    case "remove":
      return state.filter((c) => c.id !== action.id);
  }
}

export function CommentThread({
  courseId,
  initialItems,
  initialCursor,
  total,
}: {
  courseId: string;
  initialItems: CommentWithMeta[];
  initialCursor: string | null;
  total: number;
}) {
  const { data: session } = useSession();
  const [sort, setSort] = React.useState<CommentSort>("newest");
  const [items, setItems] = React.useState(initialItems);
  const [totalCount, setTotalCount] = React.useState(total);
  const [cursor, setCursor] = React.useState(initialCursor);
  const [loading, setLoading] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [optimisticItems, addOptimistic] = React.useOptimistic(items, reduceOptimistic);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const loadingRef = React.useRef(false);

  // Re-sync when the server re-renders with fresh data (e.g. navigating to
  // this course page again) — a plain useState initializer only applies on
  // mount, so this catch-up effect is required.
  React.useEffect(() => {
    setItems(initialItems);
    setTotalCount(total);
    setCursor(initialCursor);
  }, [initialItems, initialCursor, total]);

  // The page is cached and identical for every visitor, so the server renders
  // every comment as not-liked. Once we know who is looking, fetch their
  // like state for the first page and merge just that flag into what is on
  // screen. Later pages and replies already come from the API with it.
  const viewerId = session?.user?.id ?? null;
  React.useEffect(() => {
    if (!viewerId) return;
    const controller = new AbortController();
    const qs = new URLSearchParams({ courseId, sort: "newest" });
    fetch(`/api/comments?${qs}`, { cache: "no-store", signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ items: CommentWithMeta[] }>) : null))
      .then((data) => {
        if (!data) return;
        const liked = new Map(data.items.map((c) => [c.id, c.likedByMe]));
        setItems((prev) =>
          prev.map((c) => (liked.has(c.id) ? { ...c, likedByMe: liked.get(c.id) ?? false } : c))
        );
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [courseId, viewerId]);

  function submitComment(body: string): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      startTransition(async () => {
        if (!session?.user) {
          resolve({ ok: false, error: "Sign in to comment." });
          return;
        }
        const optimisticComment: CommentWithMeta = {
          id: `temp-${Math.random().toString(36).slice(2)}`,
          courseId,
          parentId: null,
          body,
          status: "VISIBLE",
          likeCount: 0,
          createdAt: new Date(),
          editedAt: null,
          user: {
            id: session.user.id,
            name: session.user.name ?? "You",
            image: session.user.image ?? null,
            // Not known client-side until the server responds — the
            // "Verified" badge briefly reflects this as unverified and
            // self-corrects the instant the real comment is merged in.
            accounts: [],
          },
          _count: { replies: 0 },
          likedByMe: false,
        };
        addOptimistic({ type: "add", comment: optimisticComment });

        const result = await safeAction(() => createCommentAction({ courseId, body }), "post comment");
        if (!result.ok) {
          resolve({ ok: false, error: result.error });
          return;
        }
        if (result.comment && result.comment.status === "VISIBLE") {
          setItems((prev) => [{ ...result.comment!, likedByMe: false }, ...prev]);
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
        const result = await safeAction(() => editCommentAction(id, body), "edit comment");
        if (!result.ok) {
          resolve({ ok: false, error: result.error });
          return;
        }
        if (result.comment) {
          setItems((prev) =>
            prev.map((c) => (c.id === id ? { ...result.comment!, likedByMe: c.likedByMe } : c))
          );
        }
        resolve({ ok: true });
      });
    });
  }

  function submitDelete(id: string): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      startTransition(async () => {
        addOptimistic({ type: "remove", id });
        const result = await safeAction(() => deleteCommentAction(id), "delete comment");
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

  async function changeSort(next: CommentSort) {
    setSort(next);
    setLoading(true);
    try {
      const res = await fetch(`/api/comments?courseId=${courseId}&sort=${next}`);
      const data = (await res.json()) as { items: CommentWithMeta[]; nextCursor: string | null };
      setItems(data.items);
      setCursor(data.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  const loadMore = React.useCallback(async () => {
    if (loadingRef.current || !cursor) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await fetch(`/api/comments?courseId=${courseId}&sort=${sort}&cursor=${cursor}`);
      const data = (await res.json()) as { items: CommentWithMeta[]; nextCursor: string | null };
      setItems((prev) => [...prev, ...data.items]);
      setCursor(data.nextCursor);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [courseId, sort, cursor]);

  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !cursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  return (
    <div className="space-y-6">
      <SignInGate prompt="Sign in with Google to join the discussion.">
        <CommentForm onSubmit={submitComment} />
      </SignInGate>

      {optimisticItems.length === 0 ? (
        <EmptyState
          icon={<MessageSquare aria-hidden />}
          title="No comments yet"
          description="Be the first to share your thoughts on this course."
        />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {totalCount} comment{totalCount === 1 ? "" : "s"}
            </p>
            <div className="w-40">
              <Select value={sort} onValueChange={(v) => void changeSort(v as CommentSort)}>
                <SelectTrigger aria-label="Sort comments">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-5">
            {optimisticItems.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                courseId={courseId}
                onEdit={submitEdit}
                onDelete={submitDelete}
                pending={comment.id.startsWith("temp-") && isPending}
              />
            ))}
          </div>

          <div ref={sentinelRef} aria-hidden className="h-px" />
          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
