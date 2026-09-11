"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Sticky header shell that gains a border and elevation only once the page has
 * actually scrolled. A header that is permanently outlined looks like it is
 * floating over nothing at the top of the page; one that never changes looks
 * detached once content slides under it. Scroll state is read with a passive
 * listener and a boolean guard, so this does no work on the vast majority of
 * scroll events.
 */
export function StickyHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 8;
      setScrolled((prev) => (prev === next ? prev : next));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled ? "true" : "false"}
      className={cn(
        "sticky top-0 z-40 transition-[background-color,box-shadow,border-color,backdrop-filter] duration-300",
        scrolled
          ? "glass-chrome border-x-0 border-t-0 border-b border-border shadow-elevated"
          : "border-x-0 border-t-0 border-b border-transparent bg-background/80 backdrop-blur-sm",
        className
      )}
    >
      {children}
    </header>
  );
}
