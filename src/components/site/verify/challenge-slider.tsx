"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { SliderParams, ChallengeCompletion } from "@/components/site/verify/types";

const HOLD_MS = 450;

export function ChallengeSlider({
  params,
  onComplete,
}: {
  params: SliderParams;
  onComplete: (completion: ChallengeCompletion) => void;
}) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [value, setValue] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [holdProgress, setHoldProgress] = React.useState(0);
  const startedAtRef = React.useRef<number | null>(null);
  const samplesRef = React.useRef(0);
  const holdStartRef = React.useRef<number | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const doneRef = React.useRef(false);

  const inZone = Math.abs(value - params.target) <= params.tolerance;

  function markInteraction() {
    if (startedAtRef.current === null) startedAtRef.current = performance.now();
    samplesRef.current += 1;
  }

  function setFromClientX(clientX: number) {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setValue(Math.max(0, Math.min(100, Math.round(pct))));
    markInteraction();
  }

  function onPointerDown(e: React.PointerEvent) {
    if (doneRef.current) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging(true);
    setFromClientX(e.clientX);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging || doneRef.current) return;
    setFromClientX(e.clientX);
  }
  function onPointerUp() {
    setDragging(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (doneRef.current) return;
    let next = value;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next -= e.shiftKey ? 10 : 2;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") next += e.shiftKey ? 10 : 2;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 100;
    else return;
    e.preventDefault();
    setValue(Math.max(0, Math.min(100, next)));
    markInteraction();
  }

  // Hold-to-confirm: fill a small progress ring while the value sits inside
  // the target zone; reset the instant it leaves. Avoids a separate submit
  // click, which keeps the interaction fast and single-gesture.
  React.useEffect(() => {
    if (doneRef.current) return;
    if (!inZone) {
      holdStartRef.current = null;
      setHoldProgress(0);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    holdStartRef.current = performance.now();
    function tick() {
      if (holdStartRef.current === null) return;
      const elapsed = performance.now() - holdStartRef.current;
      const pct = Math.min(1, elapsed / HOLD_MS);
      setHoldProgress(pct);
      if (pct >= 1) {
        doneRef.current = true;
        const elapsedMs = startedAtRef.current ? performance.now() - startedAtRef.current : HOLD_MS;
        onComplete({ solution: { value }, trace: { elapsedMs, samples: samplesRef.current } });
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inZone]);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">Drag the marker into the glowing zone and hold</p>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Align the marker within the highlighted zone"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative h-3.5 w-full max-w-sm cursor-pointer touch-none rounded-full bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        {/* Target zone */}
        <div
          aria-hidden
          className={cn(
            "absolute inset-y-0 rounded-full bg-gradient-to-r from-violet/40 to-primary/40 transition-colors",
            inZone && "from-success/50 to-success/50"
          )}
          style={{
            left: `${Math.max(0, params.target - params.tolerance)}%`,
            width: `${params.tolerance * 2}%`,
          }}
        />
        {/* Handle */}
        <motion.div
          aria-hidden
          className="absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-primary-foreground shadow-elevated ring-2 ring-primary will-change-transform"
          style={{ left: `${value}%`, x: "-50%" }}
          transition={{ type: "tween", duration: dragging ? 0 : 0.08 }}
        >
          <svg className="absolute -rotate-90" width="30" height="30" viewBox="0 0 30 30" aria-hidden>
            <circle cx="15" cy="15" r="12.5" fill="none" strokeWidth="2.5" className="stroke-primary/15" />
            <circle
              cx="15"
              cy="15"
              r="12.5"
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 12.5}
              strokeDashoffset={2 * Math.PI * 12.5 * (1 - holdProgress)}
              className="stroke-success transition-[stroke-dashoffset] duration-75"
            />
          </svg>
          <span className="h-2 w-2 rounded-full bg-primary" />
        </motion.div>
      </div>
    </div>
  );
}
