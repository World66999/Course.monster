"use client";

import { Loader2, Search } from "lucide-react";

/**
 * The leading icon of a listing filter bar's search field, plus the screen
 * reader announcement that goes with it.
 *
 * Applying a filter is a server round trip (see `useFilterParams`), and until
 * now nothing on screen changed while it was in flight — the old results just
 * sat there. This swaps the magnifier for a spinner and announces the update
 * politely, which is the whole loading state for these pages: the controls stay
 * mounted and focused, so a query can still be typed while the previous one
 * resolves.
 */
export function FilterSearchIcon({ pending }: { pending: boolean }) {
  return (
    <>
      {pending ? (
        <Loader2
          className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 animate-spin text-primary"
          aria-hidden
        />
      ) : (
        <Search
          className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {pending ? "Updating results…" : ""}
      </span>
    </>
  );
}
