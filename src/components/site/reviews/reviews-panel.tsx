"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import type { ReviewWithAuthor, ReviewSummary, ReviewSort } from "@/lib/comments";
import { createReviewAction, editReviewAction, deleteReviewAction } from "@/server/actions/reviews";
import { safeAction } from "@/lib/safe-action";
import { ReviewSummaryCard } from "@/components/site/reviews/review-summary";
import { ReviewForm, type ExistingReview } from "@/components/site/reviews/review-form";
import { ReviewList } from "@/components/site/reviews/review-list";
import { SignInGate } from "@/components/site/sign-in-gate";

type OptimisticAction =
  | { type: "add"; review: ReviewWithAuthor }
  | { type: "update"; id: string; rating: number; title: string; body: string }
  | { type: "remove"; id: string };

function reduceItems(state: ReviewWithAuthor[], action: OptimisticAction): ReviewWithAuthor[] {
  switch (action.type) {
    case "add":
      return [action.review, ...state];
    case "update":
      return state.map((r) =>
        r.id === action.id ? { ...r, rating: action.rating, title: action.title || null, body: action.body } : r
      );
    case "remove":
      return state.filter((r) => r.id !== action.id);
  }
}

/** Rating 1-5 in, out — bumps or removes one tally from a breakdown/avg snapshot. */
function adjustSummary(summary: ReviewSummary, removeRating: number | null, addRating: number | null): ReviewSummary {
  let count = summary.reviewCount;
  let sum = summary.avgRating * count;
  const breakdown = { ...summary.breakdown };
  if (removeRating) {
    sum -= removeRating;
    count -= 1;
    const key = removeRating as 1 | 2 | 3 | 4 | 5;
    breakdown[key] = Math.max(0, breakdown[key] - 1);
  }
  if (addRating) {
    sum += addRating;
    count += 1;
    const key = addRating as 1 | 2 | 3 | 4 | 5;
    breakdown[key] = (breakdown[key] ?? 0) + 1;
  }
  return { reviewCount: Math.max(0, count), avgRating: count > 0 ? sum / count : 0, breakdown };
}

export function ReviewsPanel({
  courseId,
  initialSummary,
  initialItems,
  initialCursor,
  initialMyReview,
}: {
  courseId: string;
  initialSummary: ReviewSummary;
  initialItems: ReviewWithAuthor[];
  initialCursor: string | null;
  initialMyReview: ExistingReview | null;
}) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? null;

  const [sort, setSort] = React.useState<ReviewSort>("newest");
  const [items, setItems] = React.useState(initialItems);
  const [summary, setSummary] = React.useState(initialSummary);
  const [myReview, setMyReview] = React.useState(initialMyReview);
  const [cursor, setCursor] = React.useState(initialCursor);
  const [loading, setLoading] = React.useState(false);
  const [, startTransition] = React.useTransition();

  const [optimisticItems, addOptimisticItem] = React.useOptimistic(items, reduceItems);
  const [optimisticSummary, addOptimisticSummaryDelta] = React.useOptimistic(
    summary,
    (state: ReviewSummary, delta: { remove: number | null; add: number | null }) =>
      adjustSummary(state, delta.remove, delta.add)
  );

  React.useEffect(() => {
    setItems(initialItems);
    setSummary(initialSummary);
    setMyReview(initialMyReview);
    setCursor(initialCursor);
  }, [initialItems, initialSummary, initialMyReview, initialCursor]);

  function submitReview(values: { rating: number; title: string; body: string }): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      startTransition(async () => {
        if (!session?.user) {
          resolve({ ok: false, error: "Sign in to review." });
          return;
        }

        if (myReview) {
          addOptimisticItem({ type: "update", id: myReview.id, ...values });
          addOptimisticSummaryDelta({ remove: myReview.rating, add: values.rating });

          const result = await safeAction(() => editReviewAction(myReview.id, values), "edit review");
          if (!result.ok) {
            resolve({ ok: false, error: result.error });
            return;
          }
          if (result.review) {
            setItems((prev) => prev.map((r) => (r.id === myReview.id ? result.review! : r)));
          }
          if (result.summary) setSummary(result.summary);
          setMyReview({ id: myReview.id, ...values });
          resolve({ ok: true });
          return;
        }

        const optimisticReview: ReviewWithAuthor = {
          id: `temp-${Math.random().toString(36).slice(2)}`,
          courseId,
          rating: values.rating,
          title: values.title || null,
          body: values.body,
          status: "VISIBLE",
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            id: session.user.id,
            name: session.user.name ?? "You",
            image: session.user.image ?? null,
            accounts: [],
          },
        };
        addOptimisticItem({ type: "add", review: optimisticReview });
        addOptimisticSummaryDelta({ remove: null, add: values.rating });

        const result = await safeAction(() => createReviewAction({ courseId, ...values }), "post review");
        if (!result.ok) {
          resolve({ ok: false, error: result.error });
          return;
        }
        if (result.review && result.review.status === "VISIBLE") {
          setItems((prev) => [result.review!, ...prev]);
          if (result.summary) setSummary(result.summary);
          setMyReview({ id: result.id!, ...values });
        } else {
          setMyReview({ id: result.id!, ...values });
        }
        resolve({ ok: true });
      });
    });
  }

  function submitDelete(): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!myReview) {
        resolve({ ok: false, error: "No review to delete." });
        return;
      }
      const id = myReview.id;
      const rating = myReview.rating;
      startTransition(async () => {
        addOptimisticItem({ type: "remove", id });
        addOptimisticSummaryDelta({ remove: rating, add: null });

        const result = await safeAction(() => deleteReviewAction(id), "delete review");
        if (!result.ok) {
          resolve({ ok: false, error: result.error });
          return;
        }
        setItems((prev) => prev.filter((r) => r.id !== id));
        if (result.summary) setSummary(result.summary);
        setMyReview(null);
        resolve({ ok: true });
      });
    });
  }

  async function changeSort(next: ReviewSort) {
    setSort(next);
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews?courseId=${courseId}&sort=${next}`);
      const data = (await res.json()) as { items: ReviewWithAuthor[]; nextCursor: string | null };
      setItems(data.items);
      setCursor(data.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!cursor) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews?courseId=${courseId}&sort=${sort}&cursor=${cursor}`);
      const data = (await res.json()) as { items: ReviewWithAuthor[]; nextCursor: string | null };
      setItems((prev) => [...prev, ...data.items]);
      setCursor(data.nextCursor);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <ReviewSummaryCard summary={optimisticSummary} />
      </div>
      <div className="space-y-6">
        <SignInGate prompt="Sign in with Google to write a review.">
          <ReviewForm
            existingReview={myReview}
            onSubmit={submitReview}
            onDelete={submitDelete}
          />
        </SignInGate>
        <ReviewList
          items={optimisticItems}
          sort={sort}
          onSortChange={(next) => void changeSort(next)}
          currentUserId={currentUserId}
          cursor={cursor}
          loading={loading}
          onLoadMore={() => void loadMore()}
        />
      </div>
    </div>
  );
}
