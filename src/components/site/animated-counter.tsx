"use client";

import * as React from "react";
import { formatNumber } from "@/lib/utils";

/** easeOutExpo-ish; matches the decelerate feel of --ease-emphasis. */
const ease = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Count-up number that animates once when scrolled into view.
 *
 * Server-renders the final value, so SEO, no-JS visitors and screen readers
 * get the real number; the animation only rewrites textContent from a rAF
 * loop (no React re-renders). Static under prefers-reduced-motion. This used
 * to pull in framer-motion for `animate`/`useInView`.
 */
export function AnimatedCounter({
  value,
  duration = 1.4,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node || value <= 0 || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let idle = 0;
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / (duration * 1000));
        node.textContent = formatNumber(Math.round(value * ease(t)));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        // Wait for an idle period: a counter in the hero is in view at
        // hydration, and starting it then put its per-frame text updates on
        // top of the busiest stretch of main-thread work on the page.
        idle = window.requestIdleCallback
          ? window.requestIdleCallback(run, { timeout: 1500 })
          : window.setTimeout(run, 300);
      },
      { rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(node);
    return () => {
      io.disconnect();
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      cancelAnimationFrame(frame);
      node.textContent = formatNumber(value);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {formatNumber(value)}
    </span>
  );
}
