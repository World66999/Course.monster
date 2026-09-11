"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { fadeUp, listItem, staggerContainer, stillVariants, viewportOnce } from "@/lib/motion";

/**
 * IMPORTANT — why these components never swap their element type.
 *
 * The obvious way to honour reduced motion is `if (reduce) return <div>…</div>`
 * instead of a `motion.div`. That is a trap, and it silently hid this entire
 * homepage for anyone with the OS setting on:
 *
 *   1. The server renders the `motion.div` with `initial="hidden"`, which
 *      framer emits as the inline style `opacity:0; transform:translateY(16px)`.
 *   2. On the client `useReducedMotion()` flips to true after mount and the
 *      component returns a plain `<div>`.
 *   3. React reconciles `motion.div` and `div` as the *same host type* — both
 *      are a `div` — so it reuses the existing DOM node rather than remounting.
 *   4. That inline style was set imperatively by framer, not through React
 *      props, so React has no reason to remove it, and framer is no longer
 *      managing the node. The element is stranded at `opacity: 0` forever.
 *
 * So: always render the motion component, and express reduced motion in the
 * *variants* instead. `stillVariants` collapses hidden onto visible, giving an
 * instant, movement-free appearance while framer stays in control of the node.
 */
function useVariants<T extends Parameters<typeof stillVariants>[0]>(v: T) {
  const reduce = useReducedMotion();
  return React.useMemo(() => (reduce ? stillVariants(v) : v), [reduce, v]);
}

export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const reduce = useReducedMotion();
  const variants = useVariants(fadeUp);
  const Tag = motion[as];

  return (
    <Tag
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      transition={reduce ? { duration: 0 } : { delay }}
    >
      {children}
    </Tag>
  );
}

/**
 * Staggered group. Wrap a grid/list in `<Stagger>` and each child in
 * `<StaggerItem>`; children cascade in on a single shared scroll trigger.
 *
 * The homepage previously gave all 12 category tiles and all four card grids
 * their own `<Reveal delay={i * 0.05}>`, which meant ~40 independent
 * IntersectionObservers and a hand-maintained delay ladder in every file.
 */
export function Stagger({
  children,
  className,
  stagger = 0.045,
  delayChildren = 0,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  delayChildren?: number;
  as?: "div" | "ul" | "section";
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  const variants = React.useMemo(
    () => (reduce ? staggerContainer(0, 0) : staggerContainer(stagger, delayChildren)),
    [reduce, stagger, delayChildren]
  );

  return (
    <Tag
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
    >
      {children}
    </Tag>
  );
}

export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  const variants = useVariants(listItem);
  const Tag = motion[as];
  return (
    <Tag className={className} variants={variants}>
      {children}
    </Tag>
  );
}
