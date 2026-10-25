"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/** Re-renders the server page on an interval, a bounded number of times. */
export function AutoRefresh({ everyMs, maxTries }: { everyMs: number; maxTries: number }) {
  const router = useRouter();
  React.useEffect(() => {
    let tries = 0;
    const id = setInterval(() => {
      if (++tries > maxTries) return clearInterval(id);
      router.refresh();
    }, everyMs);
    return () => clearInterval(id);
  }, [router, everyMs, maxTries]);
  return null;
}
