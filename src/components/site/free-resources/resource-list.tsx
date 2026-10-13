"use client";

import * as React from "react";
import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { FreeResourceCard, type FreeResourceCardDTO } from "@/components/site/free-resources/resource-card";
import { DirectoryCardSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/site/section";
import { buttonClasses } from "@/components/ui/button";

interface Props {
  initialItems: FreeResourceCardDTO[];
  initialCursor: string | null;
  total: number;
  queryString: string;
}

/**
 * Cursor-paginated grid. Same contract as InfiniteAppList: the server renders
 * page one so the section is useful with JavaScript still loading, and this
 * only ever *appends*.
 */
export function InfiniteResourceList({ initialItems, initialCursor, total, queryString }: Props) {
  const [items, setItems] = React.useState(initialItems);
  const [cursor, setCursor] = React.useState(initialCursor);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const loadingRef = React.useRef(false);

  // A new server render (filters changed) replaces the list rather than appending.
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
      const res = await fetch(`/api/free-resources?${qs.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: FreeResourceCardDTO[]; nextCursor: string | null };
      setItems((prev) => [...prev, ...data.items]);
      setCursor(data.nextCursor);
    } catch {
      // Offline, rate-limited or a stale cursor — surface a retry, never a stack trace.
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
        icon={<FolderOpen aria-hidden />}
        title="No resources found"
        description="Try a different search, type or source — or browse everything instead."
        action={
          <Link href="/free-resources" className={buttonClasses("outline", "sm")}>
            Clear filters
          </Link>
        }
      />
    );
  }

  return (
    <>
      <p className="mb-5 text-sm text-muted-foreground" aria-live="polite">
        Showing {items.length} of {total} resource{total === 1 ? "" : "s"}
      </p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((resource) => (
          <FreeResourceCard key={resource.id} resource={resource} />
        ))}
        {loading && Array.from({ length: 4 }, (_, i) => <DirectoryCardSkeleton key={`skeleton-${i}`} />)}
      </div>

      <div ref={sentinelRef} aria-hidden className="h-px" />

      {loading && <span role="status" className="sr-only" aria-label="Loading more resources" />}
      {error && (
        <div className="flex flex-col items-center gap-3 py-10">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load more resources.</p>
          <button
            type="button"
            onClick={() => void loadMore()}
            className="cursor-pointer rounded-control border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
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
