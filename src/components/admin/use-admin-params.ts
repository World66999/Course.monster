"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Search-param plumbing shared by the admin tables.
 *
 * Fourteen tables each carried a byte-identical copy of `update` and `goToPage`
 * — build a URLSearchParams from the current ones, set the keys with a value and
 * delete the keys without, drop `page` so a new filter starts at page 1, push —
 * plus, in most of them, the same 400ms debounce wiring the search box to it and
 * the same `eslint-disable-next-line react-hooks/exhaustive-deps` needed because
 * `update` was redefined on every render.
 *
 * `update` is memoised here, so the debounce effect can list it honestly as a
 * dependency and the disable comments go away. `isPending` comes from wrapping
 * the push in a transition, which is what lets a table dim its rows while the
 * next page is being fetched instead of showing stale rows with no feedback.
 */
export function useAdminParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const push = React.useCallback(
    (params: URLSearchParams) => {
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [router, pathname]
  );

  /** Sets or clears params, and always returns to page 1. */
  const update = React.useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      params.delete("page");
      push(params);
    },
    [searchParams, push]
  );

  const goToPage = React.useCallback(
    (next: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next > 1) params.set("page", String(next));
      else params.delete("page");
      push(params);
    },
    [searchParams, push]
  );

  return { searchParams, update, goToPage, isPending };
}

/**
 * The debounced search box wiring every admin table repeated: keep local state so
 * typing is instant, push it into the URL 400ms after the last keystroke, and
 * re-sync from the URL when it changes underneath (back button, a reset link).
 *
 * `key` is the param name — most tables use `q`, the two user tables use `uq`
 * because a user filter coexists with a content filter on the same page.
 */
export function useDebouncedParam(
  key: string,
  update: (patch: Record<string, string>) => void,
  searchParams: URLSearchParams | ReturnType<typeof useSearchParams>,
  delayMs = 400
) {
  const current = searchParams.get(key) ?? "";
  const [value, setValue] = React.useState(current);

  React.useEffect(() => setValue(current), [current]);

  React.useEffect(() => {
    if (value === current) return;
    const t = setTimeout(() => update({ [key]: value.trim() }), delayMs);
    return () => clearTimeout(t);
  }, [value, current, key, update, delayMs]);

  return [value, setValue] as const;
}
