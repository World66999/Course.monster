import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Pointer-tracking glow for cards.
 *
 * A server component: it renders a marker (`data-spotlight`) and the glow
 * layer, and nothing else. The one listener that moves the glow lives in
 * `RevealController`, which writes `--spot-x/y/o` on whichever card is under
 * the cursor. It used to be a client component per card, each with its own
 * pointer handlers and media-query listeners, twelve of them on the home page.
 *
 * Touch devices never see it (the controller only runs for fine pointers and
 * the layer stays at opacity 0), so nothing depends on hover.
 */
export function Spotlight({
  children,
  className,
  radius = 320,
}: {
  children: React.ReactNode;
  className?: string;
  radius?: number;
}) {
  return (
    <div
      data-spotlight=""
      className={cn("group/spot relative", className)}
      style={{ "--spot-r": `${radius}px` } as React.CSSProperties}
    >
      <span aria-hidden className="spotlight" />
      {children}
    </div>
  );
}
