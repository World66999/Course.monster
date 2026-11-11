"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Tells the server a page was viewed, for the admin's visitor chart
 * (see /api/visit for what is and is not recorded). Sent when the browser is
 * idle, so it never competes with loading the page. sendBeacon survives the
 * visitor leaving immediately; fetch with keepalive is the fallback.
 */
export function VisitBeacon() {
  const pathname = usePathname();
  React.useEffect(() => {
    const send = () => {
      try {
        if (navigator.sendBeacon?.("/api/visit")) return;
      } catch {
        // fall through to fetch
      }
      void fetch("/api/visit", { method: "POST", keepalive: true }).catch(() => undefined);
    };
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(send, { timeout: 3000 })
      : window.setTimeout(send, 800);
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [pathname]);
  return null;
}
