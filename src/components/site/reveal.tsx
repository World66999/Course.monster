import * as React from "react";

/**
 * Entrance animations removed per request.
 *
 * These used to fade/slide content in on scroll (framer-motion variants
 * driven by a shared viewport trigger). They now render their element
 * directly with no motion, so content is fully visible the moment a page
 * loads. The motion-only props (`delay`, `stagger`, `delayChildren`) are kept
 * in the signatures so existing call sites compile unchanged; they are
 * accepted and ignored.
 */

export function Reveal({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li";
}) {
  const Tag = as;
  return <Tag className={className}>{children}</Tag>;
}

export function Stagger({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  delayChildren?: number;
  as?: "div" | "ul" | "section";
}) {
  const Tag = as;
  return <Tag className={className}>{children}</Tag>;
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
  const Tag = as;
  return <Tag className={className}>{children}</Tag>;
}
