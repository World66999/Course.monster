"use client";

import * as React from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

/**
 * Pure composer — it owns only the textarea's local state and submitting
 * flag. The caller owns the list and decides what "submit" actually does
 * (optimistic add + server call + reconcile), via onSubmit. This is what
 * lets the same component work both as the top-level poster (owned by
 * CommentThread) and a reply composer (owned by CommentItem) without
 * duplicating the optimistic-update logic in two places.
 */
export function CommentForm({
  parentId,
  submitLabel = "Post comment",
  placeholder = "Share your thoughts about this course…",
  autoFocus,
  onSubmit,
  onCancel,
}: {
  parentId?: string;
  submitLabel?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmit: (body: string) => Promise<{ ok: boolean; error?: string }>;
  onCancel?: () => void;
}) {
  const [body, setBody] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    try {
      const result = await onSubmit(body);
      if (result.ok) {
        setBody("");
      } else {
        // Preserve the typed text so the user doesn't lose their comment.
        toast.error(result.error ?? "Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={parentId ? 2 : 3}
        maxLength={10_000}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={parentId ? "Write a reply" : "Write a comment"}
      />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" disabled={submitting || !body.trim()}>
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Send className="h-3.5 w-3.5" aria-hidden />
          )}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
