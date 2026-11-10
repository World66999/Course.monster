"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * The single piece of JavaScript behind every scroll reveal and every
 * pointer-tracking card glow on the public site (see reveal.tsx and
 * motion/interactive.tsx, which only render markers).
 *
 * Reveal: after paint, all markers are measured in one read pass, then the
 * ones below the fold are marked "pending" in one write pass and handed to a
 * shared IntersectionObserver. One layout, one small style update.
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

    const seen = new WeakSet<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.unobserve(entry.target);
          const el = entry.target;
          const attr = el.hasAttribute("data-stagger") ? "data-stagger" : "data-reveal";
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
      const nodes = document.querySelectorAll<HTMLElement>('[data-reveal=""],[data-stagger=""]');
      if (nodes.length === 0) return;
      const fold = window.innerHeight * 0.92;
      // Read phase.
      const below: HTMLElement[] = [];
      nodes.forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        if (el.getBoundingClientRect().top >= fold) below.push(el);
      });
      // Write phase.
      for (const el of below) {
        el.setAttribute(el.hasAttribute("data-stagger") ? "data-stagger" : "data-reveal", "pending");
        io.observe(el);
      }
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
