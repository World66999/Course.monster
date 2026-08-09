"use client";

import * as React from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { StarInput } from "@/components/site/reviews/stars";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

export interface ExistingReview {
  id: string;
  rating: number;
  title: string;
  body: string;
}

/**
 * Pure composer, same shape as CommentForm: it owns only its own field
 * state, the caller (ReviewsPanel) owns the list/summary and decides what
 * submit/delete actually do (optimistic update + server call + reconcile).
 */
export function ReviewForm({
  existingReview,
  onSubmit,
  onDelete,
}: {
  existingReview: ExistingReview | null;
  onSubmit: (values: { rating: number; title: string; body: string }) => Promise<{ ok: boolean; error?: string }>;
  onDelete: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const [rating, setRating] = React.useState(existingReview?.rating ?? 0);
  const [title, setTitle] = React.useState(existingReview?.title ?? "");
  const [body, setBody] = React.useState(existingReview?.body ?? "");
  const [submitting, setSubmitting] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    setRating(existingReview?.rating ?? 0);
    setTitle(existingReview?.title ?? "");
    setBody(existingReview?.body ?? "");
  }, [existingReview]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      toast.error("Please select a star rating.");
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await onSubmit({ rating, title, body });
      if (result.ok) {
        toast.success(existingReview ? "Review updated" : "Review submitted");
      } else {
        toast.error(result.error ?? "Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!existingReview || deleting) return;
    if (!window.confirm("Delete your review? This can't be undone from here.")) return;
    setDeleting(true);
    try {
      const result = await onDelete();
      if (result.ok) {
        toast.success("Review deleted");
        setRating(0);
        setTitle("");
        setBody("");
      } else {
        toast.error(result.error ?? "Something went wrong. Please try again.");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="space-y-1.5">
        <Label>Your rating</Label>
        <StarInput value={rating} onChange={setRating} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="review-title">Title (optional)</Label>
        <Input
          id="review-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Sum up your review"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="review-body">Review</Label>
        <Textarea
          id="review-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={20_000}
          placeholder="Share your experience with this course…"
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        {existingReview && (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
            Delete
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {existingReview ? "Update review" : "Submit review"}
        </Button>
      </div>
    </form>
  );
}
