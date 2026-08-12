"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { AiPlatformCard, type AiPlatformCardDTO } from "@/components/site/ai-platforms/ai-platform-card";
import { DirectoryCardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/site/section";

interface Props {
  initialItems: AiPlatformCardDTO[];
  initialCursor: string | null;
  total: number;
  queryString: string;
}

/** Cursor-paginated grid — see InfiniteResourceList for the shared contract. */
export function InfiniteAiPlatformList({ initialItems, initialCursor, total, queryString }: Props) {
  const [items, setItems] = React.useState(initialItems);
  const [cursor, setCursor] = React.useState(initialCursor);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const loadingRef = React.useRef(false);

  React.useEffect(() => {
    setItems(initialItems);
    setCursor(initialCursor);
    setError(false);
  }, [initialItems, initialCursor]);

  const loadMore = React.useCallback(async () => {
    if (loadingRef.current || !cursor) return;
    loadingRef.current = true;
    setLoading(true);
    setError(false);
    try {
      const qs = new URLSearchParams(queryString);
      qs.set("cursor", cursor);
      const res = await fetch(`/api/ai-platforms?${qs.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: AiPlatformCardDTO[]; nextCursor: string | null };
      setItems((prev) => [...prev, ...data.items]);
      setCursor(data.nextCursor);
    } catch {
      setError(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [cursor, queryString]);

  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !cursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles aria-hidden />}
        title="No AI platforms found"
        description="Try a different search, category or free-access type."
      />
    );
  }

  return (
    <>
      <p className="mb-5 text-sm text-muted-foreground" aria-live="polite">
        Showing {items.length} of {total} platform{total === 1 ? "" : "s"}
      </p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((platform) => (
          <AiPlatformCard key={platform.id} platform={platform} />
        ))}
        {loading && Array.from({ length: 4 }, (_, i) => <DirectoryCardSkeleton key={`skeleton-${i}`} />)}
      </div>

      <div ref={sentinelRef} aria-hidden className="h-px" />

      {loading && <span role="status" className="sr-only" aria-label="Loading more platforms" />}
      {error && (
        <div className="flex flex-col items-center gap-3 py-10">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load more platforms.</p>
          <button
            type="button"
            onClick={() => void loadMore()}
            className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Try again
          </button>
        </div>
      )}
      {!cursor && items.length < total && !loading && (
        <p className="py-10 text-center text-sm text-muted-foreground">You&apos;ve reached the end.</p>
      )}
    </>
  );
}
