"use client";

import * as React from "react";

/**
 * Scroll-triggered reveals, with no animation library.
 *
 * The server always renders content fully visible. After hydration, an element
 * that is still below the fold is marked `data-reveal="pending"` (hidden by
 * globals.css), and one shared IntersectionObserver flips it to `"in"` as it
 * enters the viewport, which plays a CSS transition on opacity and transform.
 *
 * Consequences that matter:
 * - Nothing already on screen at hydration ever hides, so there is no flash
 *   and no layout shift, and LCP is never an element waiting on JS.
 * - With JS disabled or slow, everything is simply visible.
 * - prefers-reduced-motion: the CSS hidden state is gated on
 *   `no-preference`, and the hook skips marking entirely.
 */

export type RevealVariant = "up" | "scale" | "left" | "right" | "fade";

type Entry = (el: Element) => void;
const callbacks = new WeakMap<Element, Entry>();
let observer: IntersectionObserver | null = null;

function getObserver() {
  if (observer) return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const cb = callbacks.get(entry.target);
        observer?.unobserve(entry.target);
        callbacks.delete(entry.target);
        cb?.(entry.target);
      }
    },
    // Trigger slightly before the element's top edge clears the bottom of the
    // viewport, so the motion is already underway as it comes into view.
    { rootMargin: "0px 0px -8% 0px", threshold: 0.01 }
  );
  return observer;
}

type Job = { el: HTMLElement; attr: "data-reveal" | "data-stagger"; onReveal?: (el: HTMLElement) => void; cancelled: boolean };
let queue: Job[] = [];

/**
 * Every Reveal on a page mounts in the same commit. Measuring and marking each
 * one inside its own effect interleaved reads and writes, so every
 * getBoundingClientRect after the first forced a fresh style + layout pass —
 * dozens of them during hydration, which Lighthouse showed as blocking time.
 * Instead the effects only enqueue; one microtask then reads every position,
 * and only after that writes any attribute. One layout for the whole page.
 */
function flush() {
  const jobs = queue.filter((j) => !j.cancelled);
  queue = [];
  const fold = window.innerHeight * 0.92;
  // Read phase. Already on screen (or scrolled past) at hydration: leave it alone.
  const below = jobs.filter((j) => j.el.getBoundingClientRect().top >= fold);
  // Write phase.
  const io = getObserver();
  for (const job of below) {
    const { el, attr } = job;
    el.setAttribute(attr, "pending");
    job.onReveal?.(el);
    callbacks.set(el, () => {
      // One frame in the pending state guarantees the transition has a start.
      requestAnimationFrame(() => el.setAttribute(attr, "in"));
    });
    io.observe(el);
  }
}

function useRevealOnScroll<T extends HTMLElement>(attr: "data-reveal" | "data-stagger", onReveal?: (el: HTMLElement) => void) {
  const ref = React.useRef<T>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const job: Job = { el, attr, onReveal, cancelled: false };
    if (queue.length === 0) queueMicrotask(flush);
    queue.push(job);
    return () => {
      job.cancelled = true;
      observer?.unobserve(el);
      callbacks.delete(el);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attr]);
  return ref;
}

export function Reveal({
  children,
  className,
  delay = 0,
  variant = "up",
  as = "div",
}: {
  children: React.ReactNode;
  /** Seconds, to match the previous framer-motion API. */
  delay?: number;
  variant?: RevealVariant;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const ref = useRevealOnScroll<HTMLDivElement>("data-reveal");
  const Tag = as as "div";
  return (
    <Tag
      ref={ref}
      className={className}
      data-reveal-variant={variant === "up" ? undefined : variant}
      style={delay ? ({ "--reveal-delay": `${Math.round(delay * 1000)}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}

/** Max children that get an incremental delay; the rest arrive with the last. */
const STAGGER_CAP = 10;

export function Stagger({
  children,
  className,
  stagger = 0.07,
  delayChildren = 0,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  /** Seconds between consecutive children. */
  stagger?: number;
  /** Seconds before the first child. */
  delayChildren?: number;
  as?: "div" | "ul" | "section";
}) {
  const ref = useRevealOnScroll<HTMLDivElement>("data-stagger", (el) => {
    Array.from(el.children).forEach((child, i) => {
      (child as HTMLElement).style.setProperty("--i", String(Math.min(i, STAGGER_CAP)));
    });
  });
  const Tag = as as "div";
  return (
    <Tag
      ref={ref}
      className={className}
      style={
        {
          "--stagger-step": `${Math.round(stagger * 1000)}ms`,
          ...(delayChildren ? { "--reveal-delay": `${Math.round(delayChildren * 1000)}ms` } : {}),
        } as React.CSSProperties
      }
    >
      {children}
    </Tag>
  );
}

/** A direct child of <Stagger>. Kept as a component so call sites read clearly. */
export function StaggerItem({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  const Tag = as;
  return <Tag className={className}>{children}</Tag>;
}
