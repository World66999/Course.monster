"use client";

import * as React from "react";
import { SearchX } from "lucide-react";
import { ResourceCard, type ResourceCardDTO } from "@/components/site/learn/resource-card";
import { ResourceCardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/site/section";

interface Props {
  initialItems: ResourceCardDTO[];
  initialCursor: string | null;
  total: number;
  queryString: string;
}

export function InfiniteResourceList({ initialItems, initialCursor, total, queryString }: Props) {
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
      const res = await fetch(`/api/learning-resources?${qs.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: ResourceCardDTO[]; nextCursor: string | null };
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
      <EmptyState icon={<SearchX aria-hidden />} title="No resources found" description="Try adjusting your search or filters." />
    );
  }

  return (
    <>
      <p className="mb-5 text-sm text-muted-foreground" aria-live="polite">
        Showing {items.length} of {total} resource{total === 1 ? "" : "s"}
      </p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} />
        ))}
        {loading && Array.from({ length: 4 }, (_, i) => <ResourceCardSkeleton key={`skeleton-${i}`} />)}
      </div>

      <div ref={sentinelRef} aria-hidden className="h-px" />

      {loading && <span role="status" className="sr-only" aria-label="Loading more resources" />}
      {error && (
        <div className="flex flex-col items-center gap-3 py-10">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load more resources.</p>
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
