import { cn } from "@/lib/utils";

/**
 * The one interactive-card surface.
 *
 * Six card components — apps, AI platforms, coding channels, free resources,
 * learn resources and course requests — each carried an identical hand-written
 * copy of this string. `border border-border bg-card shadow-soft` is exactly
 * what the `surface` utility already paints (plus the inner top highlight those
 * copies were missing), and `transition-all` animated every animatable property
 * on a node that only ever moves, shadows and changes border colour.
 *
 * Pass shape-specific classes through: `cardClasses("gap-3 p-4")` for a padded
 * card, `cardClasses("overflow-hidden")` for one that starts with media.
 */
export function cardClasses(className?: string) {
  return cn(
    "group surface relative flex flex-col rounded-card",
    "transition-[transform,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
    "hover:-translate-y-1.5 hover:border-primary/35 hover:shadow-glow",
    // Touch feedback. globals.css clears `-webkit-tap-highlight-color`
    // app-wide, and the states above are all `hover:` — which a phone never
    // triggers — so tapping a card used to produce no acknowledgement at all
    // between the tap and the next page painting. `active:` fires on touch.
    "active:scale-[0.99] active:shadow-soft",
    className
  );
}
