"use client";

import type * as React from "react";
import dynamic from "next/dynamic";
import { Menu, Search } from "lucide-react";

/**
 * Header widgets and the toaster, loaded right after hydration instead of in
 * every page's first-load bundle. None of them is needed to paint the page:
 * the search dialog and the mobile menu only matter once tapped, and toasts
 * only after an action. Each placeholder is the same button the real widget
 * renders, so nothing moves when the real one takes over.
 */

function SearchButtonPlaceholder() {
  return (
    <button
      type="button"
      aria-label="Search"
      className="tap-target inline-flex h-9 items-center gap-2 rounded-control border border-border bg-card px-2.5 text-sm text-muted-foreground shadow-soft lg:px-3 xl:px-2.5"
    >
      <Search className="h-4 w-4" aria-hidden />
      <span className="hidden lg:inline xl:hidden">Search…</span>
      <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] lg:inline xl:hidden">⌘K</kbd>
    </button>
  );
}

function MenuButtonPlaceholder() {
  return (
    <button
      type="button"
      aria-label="Open menu"
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground xl:hidden"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}

/**
 * A widget whose script fails to download (a dropped connection, a tab left
 * open across a deploy) must not take the whole page down with it: without
 * this the rejection reaches the root error screen. Try once more, then settle
 * for a plain stand-in that still gets the visitor somewhere useful.
 */
function resilient<P>(load: () => Promise<React.ComponentType<P>>, fallback: React.ComponentType<P>) {
  return () =>
    load()
      .catch(() => new Promise<void>((resolve) => setTimeout(resolve, 1200)).then(load))
      .catch(() => fallback);
}

/** Search without the dialog: the courses page has its own search box. */
function SearchFallback() {
  return (
    // A plain link on purpose: this renders only when a script failed to load,
    // so a full page load is the dependable way to move on.
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a
      href="/courses"
      aria-label="Search"
      className="tap-target inline-flex h-9 items-center gap-2 rounded-control border border-border bg-card px-2.5 text-sm text-muted-foreground shadow-soft lg:px-3 xl:px-2.5"
    >
      <Search className="h-4 w-4" aria-hidden />
      <span className="hidden lg:inline xl:hidden">Search…</span>
    </a>
  );
}

/** The menu script never arrived; loading the page again is the way to get it. */
function MenuFallback() {
  return (
    <button
      type="button"
      aria-label="Open menu"
      onClick={() => window.location.reload()}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground xl:hidden"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}

const Nothing = () => null;

export const LazySearchDialog = dynamic(
  resilient(() => import("@/components/site/search-dialog").then((m) => m.SearchDialog), SearchFallback),
  { ssr: false, loading: SearchButtonPlaceholder },
);

export const LazyMobileNav = dynamic(
  resilient<React.ComponentProps<typeof import("@/components/site/mobile-nav").MobileNav>>(
    () => import("@/components/site/mobile-nav").then((m) => m.MobileNav),
    MenuFallback,
  ),
  { ssr: false, loading: MenuButtonPlaceholder },
);

export const LazyToaster = dynamic(
  resilient(() => import("@/components/site/toaster").then((m) => m.Toaster), Nothing),
  { ssr: false },
);
