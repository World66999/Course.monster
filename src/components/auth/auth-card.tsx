"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { GraduationCap } from "lucide-react";

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
  const Wrapper = reduce ? "div" : motion.div;
  const motionProps = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.45, ease: [0.21, 0.47, 0.32, 0.98] as const },
      };

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-gradient-to-b from-primary/5 via-background to-background px-4 py-12">
      <Wrapper {...motionProps} className={wide ? "w-full max-w-md" : "w-full max-w-sm"}>
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Link
            href="/"
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-primary text-white shadow-lg shadow-primary/30"
          >
            <GraduationCap className="h-6 w-6" aria-hidden />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>

        <div className="glass rounded-2xl p-6 shadow-elevated inset-shadow-highlight sm:p-8">{children}</div>

        {footer && <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>}
      </Wrapper>
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
      <div className="h-px flex-1 bg-border" />
      or
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
