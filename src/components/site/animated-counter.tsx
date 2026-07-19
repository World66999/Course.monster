"use client";

import * as React from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";
import { formatNumber } from "@/lib/utils";

/**
 * Count-up number that animates when scrolled into view.
 * Server-renders the final value so SEO and no-JS visitors see real numbers,
 * and stays static when the visitor prefers reduced motion.
 */
export function AnimatedCounter({
  value,
  duration = 1.2,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();

  React.useEffect(() => {
    const node = ref.current;
    if (!inView || reduce || !node || value <= 0) return;
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        node.textContent = formatNumber(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [inView, reduce, value, duration]);

  return (
    <span ref={ref} className={className}>
      {formatNumber(value)}
    </span>
  );
}
