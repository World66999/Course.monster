"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** True only for a hoverable, precise pointer with no reduced-motion preference. */
function useSpotlightEnabled() {
  const [enabled, setEnabled] = React.useState(false);
  React.useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnabled(fine.matches && !reduce.matches);
    update();
    fine.addEventListener("change", update);
    reduce.addEventListener("change", update);
    return () => {
      fine.removeEventListener("change", update);
      reduce.removeEventListener("change", update);
    };
  }, []);
  return enabled;
}

/**
 * Pointer-tracking spotlight for premium cards.
 *
 * Deliberately does NOT use React state: pointermove would re-render on every
 * frame. Instead it writes two CSS custom properties straight to the node and
 * lets a CSS radial-gradient do the painting, so the whole effect costs one
 * style write per move and zero reconciliation.
 *
 * Disabled entirely on touch devices (there is no pointer to follow) and under
 * reduced motion. No animation library: this used to import framer-motion only
 * for `useReducedMotion`, which put the whole runtime on the homepage.
 */
export function Spotlight({
  children,
  className,
  radius = 320,
}: {
  children: React.ReactNode;
  className?: string;
  radius?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const active = useSpotlightEnabled();

  const onMove = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node) return;
    const r = node.getBoundingClientRect();
    node.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
    node.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
  }, []);
  const onLeave = React.useCallback(() => {
    ref.current?.style.setProperty("--spot-o", "0");
  }, []);
  const onEnter = React.useCallback(() => {
    ref.current?.style.setProperty("--spot-o", "1");
  }, []);

  return (
    <div
      ref={ref}
      className={cn("group/spot relative", className)}
      onPointerMove={active ? onMove : undefined}
      onPointerEnter={active ? onEnter : undefined}
      onPointerLeave={active ? onLeave : undefined}
      style={active ? ({ "--spot-r": `${radius}px` } as React.CSSProperties) : undefined}
    >
      {active && <span aria-hidden className="spotlight" />}
      {children}
    </div>
  );
}
