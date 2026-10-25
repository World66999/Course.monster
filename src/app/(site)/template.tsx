"use client";

import * as React from "react";

/**
 * Module-level, so it survives the template remounting on each navigation.
 * Only ever set on the client, inside an effect: server renders and the first
 * hydration both see `false`, which keeps their markup identical.
 */
let hasNavigated = false;

/**
 * Public-site route transition.
 *
 * A `template.tsx` remounts on every client-side navigation, so a CSS
 * animation on its wrapper plays once per route change. It is skipped on the
 * first page load on purpose: a fade there would only delay LCP and would
 * replay the old "entrance on open" behaviour that was removed. CSS only, and
 * the global reduced-motion rule collapses it to nothing.
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  const animate = hasNavigated;
  React.useEffect(() => {
    hasNavigated = true;
  }, []);
  return <div className={animate ? "animate-page-in" : undefined}>{children}</div>;
}
