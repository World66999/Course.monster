"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { DialParams, ChallengeCompletion } from "@/components/site/verify/types";

const HOLD_MS = 450;
const SIZE = 176;
const CENTER = SIZE / 2;
const RADIUS = 68;

function angularDistance(a: number, b: number): number {
  return Math.abs((((a - b + 540) % 360) + 360) % 360 - 180);
}

export function ChallengeDial({
  params,
  onComplete,
}: {
  params: DialParams;
  onComplete: (completion: ChallengeCompletion) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [angle, setAngle] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [holdProgress, setHoldProgress] = React.useState(0);
  const startedAtRef = React.useRef<number | null>(null);
  const samplesRef = React.useRef(0);
  const holdStartRef = React.useRef<number | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const doneRef = React.useRef(false);

  const inZone = angularDistance(angle, params.target) <= params.tolerance;

  function markInteraction() {
    if (startedAtRef.current === null) startedAtRef.current = performance.now();
    samplesRef.current += 1;
  }

  function setFromClientPoint(clientX: number, clientY: number) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const deg = (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI + 90;
    setAngle(((deg % 360) + 360) % 360);
    markInteraction();
  }

  function onPointerDown(e: React.PointerEvent) {
    if (doneRef.current) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging(true);
    setFromClientPoint(e.clientX, e.clientY);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging || doneRef.current) return;
    setFromClientPoint(e.clientX, e.clientY);
  }
  function onPointerUp() {
    setDragging(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (doneRef.current) return;
    let next = angle;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next -= e.shiftKey ? 15 : 3;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") next += e.shiftKey ? 15 : 3;
    else return;
    e.preventDefault();
    setAngle(((next % 360) + 360) % 360);
    markInteraction();
  }

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
        onComplete({ solution: { value: angle }, trace: { elapsedMs, samples: samplesRef.current } });
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

  const needleAngle = angle - 90; // svg rotation origin is 3 o'clock
  const targetX = CENTER + RADIUS * Math.cos(((params.target - 90) * Math.PI) / 180);
  const targetY = CENTER + RADIUS * Math.sin(((params.target - 90) * Math.PI) / 180);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">Rotate the dial to meet the marked point and hold</p>
      <div
        ref={containerRef}
        role="slider"
        tabIndex={0}
        aria-label="Rotate the dial to align with the target"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={Math.round(angle)}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative cursor-pointer touch-none rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        style={{ width: SIZE, height: SIZE }}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
          <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" strokeWidth="10" className="stroke-muted" />
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * RADIUS}
            strokeDashoffset={2 * Math.PI * RADIUS * (1 - holdProgress)}
            className="-rotate-90 origin-center stroke-success transition-[stroke-dashoffset] duration-75"
          />
          {/* target marker */}
          <circle
            cx={targetX}
            cy={targetY}
            r={7}
            className={cn("transition-colors", inZone ? "fill-success" : "fill-accent-ink")}
          />
          {/* needle */}
          <g style={{ transformOrigin: `${CENTER}px ${CENTER}px`, transform: `rotate(${needleAngle}deg)` }}>
            <line
              x1={CENTER}
              y1={CENTER}
              x2={CENTER + RADIUS}
              y2={CENTER}
              strokeWidth="4"
              strokeLinecap="round"
              className="stroke-primary"
            />
          </g>
          <circle cx={CENTER} cy={CENTER} r={8} className="fill-primary" />
        </svg>
      </div>
    </div>
  );
}
