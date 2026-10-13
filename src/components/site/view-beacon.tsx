"use client";

import * as React from "react";

/**
 * Reports one page view after the page has loaded, without blocking anything.
 * sendBeacon survives the visitor navigating away immediately; fetch with
 * keepalive is the fallback where it is unavailable.
 */
export function CourseViewBeacon({ slug }: { slug: string }) {
  React.useEffect(() => {
    const body = JSON.stringify({ slug });
    try {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon?.("/api/courses/view", blob)) return;
    } catch {
      // fall through to fetch
    }
    void fetch("/api/courses/view", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => undefined);
  }, [slug]);
  return null;
}
