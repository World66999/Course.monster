"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Sticky header that turns into a floating pill once the page has scrolled.
 *
 * The header's own box never changes size: the pill is an absolutely
 * positioned backdrop layer behind the content that fades and scales in
 * (opacity + transform only), so the transition cannot shift layout. The
 * pill is opaque (`glass-chrome`): backdrop-filter was removed app-wide as the
 * main source of mobile scroll jank. Scroll state is read with a passive
 * listener and a boolean guard, so almost every scroll event is a no-op.
 */
export function StickyHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 12;
      setScrolled((prev) => (prev === next ? prev : next));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled ? "true" : "false"}
      className={cn("group/header sticky top-0 z-40 pt-2", className)}
    >
      <div className="relative mx-auto max-w-7xl px-2 sm:px-3">
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-2 inset-y-0 rounded-full sm:inset-x-3",
            "transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            scrolled
              ? "glass-chrome scale-100 opacity-100 shadow-elevated"
              : "scale-[0.98] opacity-0"
          )}
        />
        <div className="relative">{children}</div>
      </div>
    </header>
  );
}
