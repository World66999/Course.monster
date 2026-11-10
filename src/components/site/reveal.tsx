import * as React from "react";

/**
 * Scroll-triggered reveals with no per-element JavaScript.
 *
 * These are plain server components: they render an element with a
 * `data-reveal` / `data-stagger` marker and nothing else. One shared
 * controller (`RevealController`, mounted once in the site layout) finds the
 * markers after the page has painted, hides only the ones still below the
 * fold, and flips them to "in" as they scroll into view. The transition is
 * CSS (opacity + transform only, see globals.css).
 *
 * Consequences that matter:
 * - The server HTML is always fully visible, so no-JS visitors, crawlers and
 *   slow connections see everything, and LCP never waits on a script.
 * - Nothing already on screen ever hides, so there is no flash.
 * - Stagger delays come from `:nth-child()` rules, not from custom properties
 *   written per child. Writing an inherited custom property on every child
 *   after hydration forced a style recalculation of each child's whole
 *   subtree (≈800 elements on the home page); this costs none.
 * - Reduced motion and low-end devices: the controller does nothing.
 */

export type RevealVariant = "up" | "scale" | "left" | "right" | "fade";

export function Reveal({
  children,
  className,
  delay = 0,
  variant = "up",
  as = "div",
}: {
  children: React.ReactNode;
  /** Seconds. */
  delay?: number;
  variant?: RevealVariant;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const Tag = as as "div";
  return (
    <Tag
      className={className}
      data-reveal=""
      data-reveal-variant={variant === "up" ? undefined : variant}
      style={delay ? ({ "--reveal-delay": `${Math.round(delay * 1000)}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}

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
  const Tag = as as "div";
  return (
    <Tag
      className={className}
      data-stagger=""
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
