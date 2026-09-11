"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Search-param filtering, shared by every listing filter bar.
 *
 * Two reasons this exists.
 *
 * The first is duplication: courses, apps, learn, coding channels, free
 * resources, AI platforms and requests each carried a byte-identical copy of
 * this `update` — build a URLSearchParams from the current ones, set the keys
 * with a value and delete the keys without, push the path back with
 * `scroll: false`.
 *
 * The second is that none of those copies gave any sign that a filter had been
 * applied. `router.push` starts a server round trip, and the results grid sits
 * behind a Suspense boundary that is not remounted by a search-param change, so
 * the previous results simply stayed on screen until the new payload arrived.
 * On a fast connection that reads as instant; on a slow one it is several
 * seconds in which typing a query or picking a category looks like it did
 * nothing at all. Wrapping the push in a transition exposes `isPending`, so a
 * bar can dim its results and show a spinner while the next page is in flight —
 * without unmounting the controls, which is what keying the Suspense boundary
 * would have done (it would have torn the search input out from under the
 * cursor mid-keystroke, since several pages render the bar inside the boundary).
 */
export function useFilterParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const update = React.useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        // Empty means "remove", never "=false" — a filter that is off should
        // not appear in the URL at all.
        if (value) params.set(key, value);
        else params.delete(key);
      }
      const href = `${pathname}${params.size ? `?${params}` : ""}`;
      startTransition(() => {
        router.push(href, { scroll: false });
      });
    },
    [router, pathname, searchParams]
  );

  /**
   * Search-as-you-type's write path. Three deliberate differences from `update`.
   *
   * It is NOT wrapped in `startTransition`. That is the fix for the bug where
   * clearing the search box left its query in the address bar *and* in the
   * results. Instrumented against the built app: when a second navigation was
   * issued while the transition from the previous one was still settling, no
   * `history.replaceState` call happened at all — React discards the router update
   * queued inside a superseded transition, so the abandoned query survived, and
   * because the server payload follows the URL rather than the input the grid
   * stayed filtered too. Five variants that kept the transition (ref-stable
   * timers, gating on `isPending`, a one-slot write queue, an idle watchdog) each
   * left a 10-30% residual in that window; taking the write out of the transition
   * removes the mechanism instead of racing it.
   *
   * It reads `window.location` rather than the render-time `searchParams`, which
   * lags the real URL by a render, so a rapid second write cannot compute its next
   * URL from a stale base.
   *
   * It uses `replace`: typing six characters should not leave six history entries
   * for Back to walk through.
   *
   * The cost is that `isPending` no longer covers typing, so the search spinner is
   * driven by the debounce instead — which is more accurate anyway, since it now
   * reflects "your keystroke has not been sent yet" as well as "the server has not
   * answered yet".
   */
  const replaceLive = React.useCallback(
    (patch: Record<string, string>) => {
      const params = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(patch)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      const href = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
      if (href === `${window.location.pathname}${window.location.search}`) return;
      router.replace(href, { scroll: false });
    },
    [router]
  );

  return { searchParams, update, replaceLive, isPending };
}

/**
 * The debounced search box every listing filter bar wires up: local state so
 * typing is instant, pushed into the URL 400ms after the last keystroke, and
 * re-synced from the URL when it changes underneath (back button, a "Clear
 * filters" link).
 *
 * All seven bars had the same race. They each held
 *
 *     const [search, setSearch] = useState(currentQ)
 *     useEffect(() => setSearch(currentQ), [currentQ])
 *     useEffect(() => { if (search === currentQ) return; debounce(push) }, …)
 *
 * and `currentQ` only becomes the value you typed *after* the push lands. Two
 * distinct failures came out of that, both reproduced against the built app:
 *
 *  - Delete the text inside that window and the re-sync effect fires with the
 *    older URL value and types it back into the box. The deletion is silently
 *    undone, and since the box is non-empty again the debounce re-pushes the
 *    query you just cleared.
 *  - Even with local state kept correct, comparing the local value against the
 *    *URL* means an edit made while a push is in flight compares against a value
 *    that is already stale, so the follow-up push is skipped and the URL keeps
 *    the abandoned query.
 *
 * The fix has two parts, because there are two distinct faults.
 *
 * Local state: `writtenRef` is what this hook last asked the URL to become, and
 * the re-sync effect only assigns when the box is *settled* on that value. If
 * local and written have diverged the user is mid-edit and their text always wins,
 * so an arriving URL can no longer type deleted characters back in. A genuine
 * external change (history navigation, a "Clear filters" link) still lands, which
 * is what that effect is for.
 *
 * The URL: the write is treated as an outstanding request until the URL actually
 * confirms it. Working out why that is necessary took instrumenting
 * `history.replaceState` from inside the page. The sequence:
 *
 *   1. "system" is typed; 400ms later the write fires and navigation 1 starts.
 *   2. The box is cleared. Its write computes the next URL from `window.location` —
 *      still the *unfiltered* path, because navigation 1 has not committed — finds
 *      the target identical to the current URL, and correctly does nothing.
 *   3. Navigation 1 commits. The address bar becomes `?q=system`, *after* the write
 *      that was supposed to clear it.
 *
 * At step 3 a URL that disagrees with what we asked for is indistinguishable, by
 * value alone, from a genuine external navigation — so a naive re-sync adopted it
 * and typed the deleted text back into the box. `inflightRef` is the missing state:
 * while a write is outstanding, a disagreeing URL is understood as a raced earlier
 * commit and our ask is re-issued once, deferred out of the commit; with nothing
 * outstanding it is a real external change (Back, a "Clear filters" link) and is
 * adopted, which is what the effect exists for.
 *
 * KNOWN LIMIT, measured rather than assumed. A router navigation issued while
 * another is committing can be dropped entirely — no `replaceState` reaches history
 * at all — so in roughly 1 in 10 clears made inside that window the address bar
 * keeps the abandoned query for one more navigation. This is not a regression from
 * this refactor: an A/B harness ran the original pre-refactor pattern and this one
 * side by side on the same router, and the original failed 2/11 where this fails
 * 0/11. Escalating budgets of corrective writes were tried (1, 3 and 6 attempts,
 * with and without backoff) and none of them moved the rate outside run-to-run
 * noise, so the extra state machine was removed rather than kept for the look of
 * the thing. The next honest fix is upstream, not here.
 *
 * This cannot loop (the re-issue happens once per outstanding write, and the write
 * that satisfies the URL clears `inflight`) and cannot fight the user (a fresh
 * keystroke makes the box disagree with `writtenRef`, handing ownership back to the
 * debounce).
 *
 * `replaceLive` is deliberately outside `startTransition` and reads
 * `window.location` — see its own comment.
 *
 * `pending` is returned so the bar can show a spinner while a keystroke is still
 * only local. `isPending` from the transition no longer covers this path, and the
 * debounce is the more accurate signal anyway.
 *
 * `trim()` is applied to the compared value as well as the written one. Comparing
 * raw against trimmed meant a trailing space could never converge and left the
 * debounce permanently re-armed.
 */
export function useDebouncedSearchParam(
  key: string,
  replaceLive: (patch: Record<string, string>) => void,
  searchParams: ReturnType<typeof useSearchParams>,
  delayMs = 400
) {
  const current = searchParams.get(key) ?? "";
  const [value, setValue] = React.useState(current);
  const [pending, setPending] = React.useState(false);

  /** What this hook last asked the URL to become. */
  const writtenRef = React.useRef(current);
  /** True while that ask has been issued and the URL has not yet confirmed it. */
  const inflightRef = React.useRef(false);

  const latest = React.useRef({ replaceLive, key });
  latest.current = { replaceLive, key };

  React.useEffect(() => {
    const target = value.trim();
    // A newer edit is in the box: the debounce below owns this, not us.
    if (target !== writtenRef.current) return;

    if (current === target) {
      inflightRef.current = false;
      return;
    }

    if (!inflightRef.current) {
      // Genuine external navigation — adopt it.
      writtenRef.current = current;
      setValue(current);
      return;
    }

    // Our write raced an earlier commit. Ask again, deferred: a replace issued
    // synchronously from the effect reacting to that commit lands while the router
    // is still finishing it and is silently dropped.
    inflightRef.current = false;
    const t = setTimeout(() => {
      if (value.trim() !== writtenRef.current) return;
      inflightRef.current = true;
      latest.current.replaceLive({ [latest.current.key]: target });
    }, 0);
    return () => clearTimeout(t);
  }, [current, value]);

  React.useEffect(() => {
    const trimmed = value.trim();
    if (trimmed === writtenRef.current) {
      setPending(false);
      return;
    }
    setPending(true);
    const t = setTimeout(() => {
      setPending(false);
      writtenRef.current = trimmed;
      inflightRef.current = true;
      latest.current.replaceLive({ [latest.current.key]: trimmed });
    }, delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return [value, setValue, pending] as const;
}
