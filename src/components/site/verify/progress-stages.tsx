"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = ["Checking Environment", "Validating Session", "Preparing Secure Access", "Verification Ready"] as const;

export function ProgressStages({ activeIndex }: { activeIndex: number }) {
  const reduceMotion = useReducedMotion();

  return (
    <ol className="flex w-full max-w-sm flex-col gap-2.5" aria-label="Verification progress">
      {STAGES.map((label, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <li key={label} className="flex items-center gap-3 text-sm">
            <span
              className={cn(
                "relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                done && "border-success bg-success/15",
                active && "border-primary",
                !done && !active && "border-border"
              )}
              aria-hidden
            >
              {done ? (
                <Check className="h-3 w-3 text-success" strokeWidth={3} />
              ) : active ? (
                <motion.span
                  className="h-2 w-2 rounded-full bg-primary"
                  animate={reduceMotion ? {} : { scale: [1, 1.5, 1], opacity: [1, 0.6, 1] }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
                />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-border" />
              )}
            </span>
            <span
              className={cn(
                "transition-colors duration-300",
                done ? "text-foreground/70" : active ? "font-medium text-foreground" : "text-muted-foreground"
              )}
              aria-current={active ? "step" : undefined}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
