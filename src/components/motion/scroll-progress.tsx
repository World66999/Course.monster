/**
 * Reading-progress bar pinned under the header.
 *
 * Pure CSS: a scroll-driven animation (`animation-timeline: scroll()`, see
 * `.scroll-progress` in globals.css) scales a single element on the
 * compositor. It used to be a framer-motion `useScroll`/`useSpring` client
 * component, which shipped the motion runtime to every public page and ran JS
 * on every scroll frame. Browsers without scroll timelines simply don't show
 * the bar — it is decorative and duplicates the scrollbar. Hidden from
 * assistive tech for the same reason.
 */
export function ScrollProgress() {
  return (
    <div
      aria-hidden
      className="scroll-progress fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-gradient-to-r from-primary via-primary to-accent"
    />
  );
}
