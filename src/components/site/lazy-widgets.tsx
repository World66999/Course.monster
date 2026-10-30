"use client";

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
      className="tap-target inline-flex h-9 items-center gap-2 rounded-control border border-border bg-card px-2.5 text-sm text-muted-foreground shadow-soft lg:px-3"
    >
      <Search className="h-4 w-4" aria-hidden />
      <span className="hidden lg:inline">Search…</span>
      <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] lg:inline">⌘K</kbd>
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

export const LazySearchDialog = dynamic(() => import("@/components/site/search-dialog").then((m) => m.SearchDialog), {
  ssr: false,
  loading: SearchButtonPlaceholder,
});

export const LazyMobileNav = dynamic(() => import("@/components/site/mobile-nav").then((m) => m.MobileNav), {
  ssr: false,
  loading: MenuButtonPlaceholder,
});

export const LazyToaster = dynamic(() => import("sonner").then((m) => m.Toaster), { ssr: false });
