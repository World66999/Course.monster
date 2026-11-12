"use client";

import * as React from "react";

type NetworkInfo = { saveData?: boolean; effectiveType?: string; downlink?: number };

/**
 * Should this visitor get the hero video at all? Only a desktop-class device
 * on a fast, unmetered connection that has not asked for less motion or less
 * data. Everything else keeps the CSS light (`hero-aurora`), which costs no
 * download. Phones never pass: they fail the width and the pointer test.
 */
function wantsVideo(): boolean {
  const mq = (q: string) => window.matchMedia(q).matches;
  if (!mq("(min-width: 1024px) and (hover: hover) and (pointer: fine)")) return false;
  if (mq("(prefers-reduced-motion: reduce)") || mq("(prefers-reduced-data: reduce)")) return false;
  if (document.documentElement.dataset.perf === "low") return false;
  const net = (navigator as Navigator & { connection?: NetworkInfo }).connection;
  if (net) {
    if (net.saveData) return false;
    if (net.effectiveType && net.effectiveType !== "4g") return false;
    if (typeof net.downlink === "number" && net.downlink < 5) return false;
  }
  return true;
}

/**
 * A short, silent loop of soft light behind the homepage hero.
 *
 * Nothing is rendered on the server and nothing is requested until the page
 * has finished loading and the browser is idle, so the video can never delay
 * the first paint or the main content. It fades in once it is actually
 * playing, stops while the hero is off screen, and is purely decorative
 * (hidden from assistive tech, not focusable, no controls).
 */
export function HeroVideo() {
  const [show, setShow] = React.useState(false);
  const [playing, setPlaying] = React.useState(false);
  const ref = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (!wantsVideo()) return;
    let idle = 0;
    const start = () => {
      idle = window.requestIdleCallback
        ? window.requestIdleCallback(() => setShow(true), { timeout: 4000 })
        : window.setTimeout(() => setShow(true), 1200);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, []);

  // Play only while the hero is on screen.
  React.useEffect(() => {
    const video = ref.current;
    if (!show || !video || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void video.play().catch(() => {});
      else video.pause();
    });
    io.observe(video);
    return () => io.disconnect();
  }, [show]);

  if (!show) return null;
  return (
    <video
      ref={ref}
      className="hero-video"
      data-on={playing}
      muted
      playsInline
      loop
      autoPlay
      preload="none"
      poster="/hero/hero-poster.jpg"
      aria-hidden
      tabIndex={-1}
      disablePictureInPicture
      onPlaying={() => setPlaying(true)}
    >
      <source src="/hero/hero.webm" type="video/webm" />
      <source src="/hero/hero.mp4" type="video/mp4" />
    </video>
  );
}
