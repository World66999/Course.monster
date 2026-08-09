"use client";

import { Loader2 } from "lucide-react";
import type { ReviewWithAuthor, ReviewSort } from "@/lib/comments";
import { ReviewItem } from "@/components/site/reviews/review-item";
import { buttonClasses } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SORTS: { value: ReviewSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
];

export function ReviewList({
  items,
  sort,
  onSortChange,
  currentUserId,
  cursor,
  loading,
  onLoadMore,
}: {
  items: ReviewWithAuthor[];
  sort: ReviewSort;
  onSortChange: (sort: ReviewSort) => void;
  currentUserId: string | null;
  cursor: string | null;
  loading: boolean;
  onLoadMore: () => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="w-48">
          <Select value={sort} onValueChange={(v) => onSortChange(v as ReviewSort)}>
            <SelectTrigger aria-label="Sort reviews">
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

      <div className="space-y-4">
        {items.map((review) => (
          <ReviewItem key={review.id} review={review} isOwn={review.user.id === currentUserId} />
        ))}
      </div>

      {cursor && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loading}
            className={buttonClasses("outline", "sm")}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Load more reviews
          </button>
        </div>
      )}
    </div>
  );
}
