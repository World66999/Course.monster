"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { SequenceParams, ChallengeCompletion } from "@/components/site/verify/types";

const FLASH_MS = 550;
const GAP_MS = 250;

export function ChallengeSequence({
  params,
  onComplete,
}: {
  params: SequenceParams;
  onComplete: (completion: ChallengeCompletion) => void;
}) {
  const [replaying, setReplaying] = React.useState(true);
  const [litIndex, setLitIndex] = React.useState<number | null>(null);
  const [taps, setTaps] = React.useState<number[]>([]);
  const startedAtRef = React.useRef<number | null>(null);
  const doneRef = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    params.sequence.forEach((tile, i) => {
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          setLitIndex(tile);
        }, i * (FLASH_MS + GAP_MS))
      );
      timers.push(
        setTimeout(
          () => {
            if (cancelled) return;
            setLitIndex(null);
          },
          i * (FLASH_MS + GAP_MS) + FLASH_MS
        )
      );
    });
    timers.push(
      setTimeout(
        () => {
          if (cancelled) return;
          setReplaying(false);
          startedAtRef.current = performance.now();
        },
        params.sequence.length * (FLASH_MS + GAP_MS)
      )
    );
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onTap(tile: number) {
    if (replaying || doneRef.current) return;
    const next = [...taps, tile];
    setTaps(next);
    setLitIndex(tile);
    setTimeout(() => setLitIndex((cur) => (cur === tile ? null : cur)), 180);
    if (next.length >= params.sequence.length) {
      doneRef.current = true;
      const elapsedMs = startedAtRef.current ? performance.now() - startedAtRef.current : 0;
      onComplete({ solution: { taps: next }, trace: { elapsedMs, samples: next.length } });
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {replaying ? "Watch the highlighted tiles…" : "Now tap them back in the same order"}
      </p>
      <div className="grid grid-cols-3 gap-3" role="group" aria-label="Pattern tiles">
        {Array.from({ length: params.tiles }, (_, i) => i).map((tile) => {
          const isLit = litIndex === tile;
          const tapIndex = taps.indexOf(tile);
          const isTapped = tapIndex !== -1;
          return (
            <button
              key={tile}
              type="button"
              disabled={replaying}
              onClick={() => onTap(tile)}
              aria-label={`Tile ${tile + 1}`}
              aria-pressed={isTapped}
              className={cn(
                "h-14 w-14 rounded-2xl border transition-all duration-150 will-change-transform sm:h-16 sm:w-16",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                isLit
                  ? "scale-105 border-primary bg-primary shadow-elevated"
                  : isTapped
                    ? "border-success/40 bg-success/15"
                    : "border-border bg-muted hover:bg-muted/70",
                replaying ? "cursor-default" : "cursor-pointer"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
