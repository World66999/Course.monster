"use client";

import * as React from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { hover, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** True only for devices that actually have a hoverable, precise pointer. */
function useFinePointer() {
  const [fine, setFine] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const on = () => setFine(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return fine;
}

/**
 * Hover elevation for interactive surfaces.
 *
 * Always a motion component (never swapped for a plain div) so framer keeps
 * ownership of the node — see the note in components/site/reveal.tsx. Under
 * reduced motion the variants collapse to no movement rather than the element
 * changing type.
 */
export function HoverLift({
  children,
  className,
  strength = "md",
  ...rest
}: React.ComponentProps<typeof motion.div> & { strength?: "sm" | "md" }) {
  const reduce = useReducedMotion();
  const lift = strength === "sm" ? hover.liftSm : hover.lift;
  return (
    <motion.div
      className={className}
      whileHover={reduce ? undefined : lift}
      whileTap={reduce ? undefined : hover.press}
      {...rest}
    >
      {children}
    </motion.div>
  );
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
 * reduced motion.
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
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  const active = fine && !reduce;

  const onMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const node = ref.current;
      if (!node) return;
      const r = node.getBoundingClientRect();
      node.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
      node.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
    },
    []
  );

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

/**
 * Magnetic CTA. The button drifts a few pixels toward the cursor while it is
 * nearby, which makes a primary action feel like it is reaching back.
 *
 * Capped at 6px of travel — enough to feel alive, small enough that the hit
 * target never moves out from under the pointer. Fine pointers only.
 *
 * Driven by motion values rather than React state for the same reason Spotlight
 * above avoids state: `setOffset` on every pointermove re-rendered this subtree
 * once per pointer frame (~60-120 renders/second while the cursor was anywhere
 * over the CTA). Motion values are written outside React and animated on the
 * compositor, so tracking the cursor now costs zero reconciliation.
 */
export function Magnetic({
  children,
  className,
  strength = 6,
}: {
  children: React.ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const fine = useFinePointer();
  const reduce = useReducedMotion();
  const active = fine && !reduce;

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, spring.soft as Parameters<typeof useSpring>[1]);
  const y = useSpring(my, spring.soft as Parameters<typeof useSpring>[1]);

  const onMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const node = ref.current;
      if (!node) return;
      const r = node.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      mx.set(Math.max(-1, Math.min(1, dx)) * strength);
      my.set(Math.max(-1, Math.min(1, dy)) * strength);
    },
    [mx, my, strength]
  );

  const onLeave = React.useCallback(() => {
    mx.set(0);
    my.set(0);
  }, [mx, my]);

  // Reduced motion / touch: the wrapper still renders (never swap element type —
  // see the note in components/site/reveal.tsx) but stays put.
  React.useEffect(() => {
    if (active) return;
    mx.set(0);
    my.set(0);
  }, [active, mx, my]);

  return (
    <motion.div
      ref={ref}
      className={cn("inline-block", className)}
      onPointerMove={active ? onMove : undefined}
      onPointerLeave={active ? onLeave : undefined}
      style={active ? { x, y } : undefined}
    >
      {children}
    </motion.div>
  );
}
