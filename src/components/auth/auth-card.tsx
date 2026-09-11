"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { GraduationCap } from "lucide-react";
import { transition, travel } from "@/lib/motion";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const reduce = useReducedMotion();
  // Always a motion component — swapping to a plain <div> strands framer's
  // imperative inline opacity on a reused DOM node. See reveal.tsx.
  const motionProps = {
    initial: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: travel.md },
    animate: { opacity: 1, y: 0 },
    transition: reduce ? { duration: 0 } : transition.slow,
  };

  return (
    <div className="relative isolate flex min-h-[calc(100dvh-4rem)] items-center justify-center overflow-hidden px-4 py-12">
      {/* Auth pages get the same two background layers as the hero, so signing
          in feels like part of the product rather than a bare utility screen. */}
      <div className="bg-grid absolute inset-0" aria-hidden />
      <div className="bg-aurora absolute inset-0" aria-hidden />
      <div
        aria-hidden
        className="absolute -top-40 left-1/2 h-80 w-[34rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[110px]"
      />

      <motion.div {...motionProps} className={`relative ${wide ? "w-full max-w-md" : "w-full max-w-sm"}`}>
        <div className="mb-7 flex flex-col items-center gap-4 text-center">
          <Link
            href="/"
            aria-label="Back to home"
            className="group relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-panel bg-primary text-primary-foreground shadow-primary inset-shadow-highlight transition-transform duration-300 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span aria-hidden className="absolute -right-2 -bottom-2 h-8 w-8 rounded-full bg-accent/70 blur-[8px]" />
            <GraduationCap className="relative h-6 w-6" aria-hidden />
          </Link>
          <div>
            <h1 className="text-heading">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>

        <div className="rounded-panel border border-border bg-card p-6 shadow-floating inset-shadow-highlight sm:p-8">
          {children}
        </div>

        {footer && <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>}
      </motion.div>
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
      <div className="hairline h-px flex-1" />
      or
      <div className="hairline h-px flex-1" />
    </div>
  );
}
