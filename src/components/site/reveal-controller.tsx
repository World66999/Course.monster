"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * The single piece of JavaScript behind every scroll reveal and every
 * pointer-tracking card glow on the public site (see reveal.tsx and
 * motion/interactive.tsx, which only render markers).
 *
 * Reveal: after paint, every marker is handed to one shared
 * IntersectionObserver. Markers it reports as out of view are marked
 * "pending" (hidden) and revealed when they scroll in; markers already on
 * screen are never touched. No layout is read from script.
 *
 * Spotlight: one passive pointermove listener on the document (fine pointers
 * only) writes the glow position on the card under the cursor.
 *
 * Both are skipped under reduced motion and on devices the boot script marked
 * as low-end; content is fully visible either way.
 */
export function RevealController() {
  const pathname = usePathname();

  // ----- scroll reveals -----
  React.useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (document.documentElement.dataset.perf === "low") return;

    // The observer does the measuring. Its first report for an element says
    // whether that element is already on screen, worked out during the
    // browser's own layout pass. Reading positions here instead
    // (getBoundingClientRect) forced an extra layout, and forced the browser
    // to lay out the off-screen sections it is otherwise allowed to skip.
    const seen = new WeakSet<Element>();
    const judged = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target;
          const attr = el.hasAttribute("data-stagger") ? "data-stagger" : "data-reveal";
          if (!judged.has(el)) {
            judged.add(el);
            if (entry.isIntersecting) {
              // Already painted and on screen: leave it alone.
              io.unobserve(el);
            } else {
              // Out of view: hide it now, reveal it when it scrolls in.
              el.setAttribute(attr, "pending");
            }
            continue;
          }
          if (!entry.isIntersecting) continue;
          io.unobserve(el);
          // One frame in the pending state guarantees the transition has a start.
          requestAnimationFrame(() => el.setAttribute(attr, "in"));
        }
      },
      // Start slightly before the element's top clears the bottom edge.
      { rootMargin: "0px 0px -8% 0px", threshold: 0.01 }
    );

    let frame = 0;
    let timer = 0;
    const scan = () => {
      frame = 0;
      timer = 0;
      document.querySelectorAll<HTMLElement>('[data-reveal=""],[data-stagger=""]').forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        io.observe(el);
      });
    };
    const schedule = () => {
      if (frame || timer) return;
      // After the frame that painted the new content, never inside it.
      frame = requestAnimationFrame(() => {
        timer = window.setTimeout(scan, 0);
      });
    };

    schedule();
    // Content that arrives later: streamed sections, infinite-scroll pages.
    const mo = new MutationObserver((records) => {
      const added = records.some((r) => Array.prototype.some.call(r.addedNodes, (n: Node) => n.nodeType === 1));
      if (added) schedule();
    });
    const main = document.getElementById("main-content") ?? document.body;
    mo.observe(main, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      io.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [pathname]);

  // ----- pointer glow -----
  React.useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!fine.matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (document.documentElement.dataset.perf === "low") return;

    let current: HTMLElement | null = null;
    const onMove = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-spotlight]") : null;
      if (target !== current) {
        current?.style.setProperty("--spot-o", "0");
        current = target;
        current?.style.setProperty("--spot-o", "1");
      }
      if (!current) return;
      const r = current.getBoundingClientRect();
      current.style.setProperty("--spot-x", `${e.clientX - r.left}px`);
      current.style.setProperty("--spot-y", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, []);

  return null;
}
