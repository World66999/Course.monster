"use client";

import { motion, useReducedMotion } from "framer-motion";
import { pageTransition } from "@/lib/motion";

/**
 * Route transition for the public site.
 *
 * `template.tsx` (not `layout.tsx`) because Next remounts a template on every
 * navigation, which is exactly the lifecycle a transition needs — a layout
 * persists and would never re-run the animation.
 *
 * Kept to 220ms and 6px. A page transition is the one animation a user is
 * forced to wait through on every single navigation, so anything longer stops
 * reading as polish and starts reading as latency.
 *
 * `initial={false}` under reduced motion renders straight at the final state.
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      variants={pageTransition}
      initial={reduce ? false : "hidden"}
      animate="visible"
    >
      {children}
    </motion.div>
  );
}
