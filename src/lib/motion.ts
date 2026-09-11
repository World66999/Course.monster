import type { Transition, Variants } from "framer-motion";

/**
 * One motion rhythm for the whole product.
 *
 * Before this existed, components hard-coded seven different durations
 * (75/100/150/200/300/500/1000ms) and five different framer-motion `duration`
 * values, so nothing felt like it belonged to the same product. Everything
 * animated should now pull from here, and the values mirror the `--ease-*`
 * custom properties in globals.css so CSS transitions and JS springs agree.
 *
 * Rules encoded below:
 *  - Exits run at ~65% of their enter duration, so dismissal feels immediate.
 *  - Arrivals decelerate (`emphasis`); departures accelerate (`exit`).
 *  - Only `transform` and `opacity` are animated — never width/height/top/left.
 */

export const duration = {
  /** Colour/opacity swaps on a control the pointer is already touching. */
  instant: 0.12,
  /** Default for hover, focus and small state changes. */
  fast: 0.2,
  /** Panels, cards, and anything crossing a short distance. */
  base: 0.32,
  /** Full-width or full-height surfaces entering. */
  slow: 0.5,
} as const;

export const ease = {
  emphasis: [0.22, 1, 0.36, 1],
  exit: [0.4, 0, 1, 1],
  standard: [0.4, 0, 0.2, 1],
} as const;

/**
 * Spring presets. Springs are used where a gesture or a direct manipulation is
 * involved (press, drag, layout shifts) because they settle naturally; timed
 * curves are used for scripted entrances where an exact duration matters.
 */
export const spring = {
  /** Snappy, barely any overshoot — buttons, toggles, icon swaps. */
  crisp: { type: "spring", stiffness: 520, damping: 34, mass: 0.7 },
  /** Default panel/card spring with a hint of settle. */
  soft: { type: "spring", stiffness: 320, damping: 30, mass: 0.9 },
  /** Larger surfaces that should feel weighty rather than bouncy. */
  heavy: { type: "spring", stiffness: 210, damping: 28, mass: 1.1 },
} satisfies Record<string, Transition>;

export const transition = {
  fast: { duration: duration.fast, ease: ease.emphasis },
  base: { duration: duration.base, ease: ease.emphasis },
  slow: { duration: duration.slow, ease: ease.emphasis },
  exit: { duration: duration.fast, ease: ease.exit },
} satisfies Record<string, Transition>;

/** Distance tokens, so "rises into place" means the same thing everywhere. */
export const travel = {
  sm: 8,
  md: 16,
  lg: 28,
} as const;

/* -------------------------------------------------------------------------- */
/*  Variants                                                                   */
/* -------------------------------------------------------------------------- */

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transition.base },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: travel.md },
  visible: { opacity: 1, y: 0, transition: transition.base },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: spring.soft },
};

/**
 * Parent for a staggered group. Children animate via `listItem` and inherit
 * timing from here, which means a grid of 12 cards costs ONE scroll observer
 * instead of 12 — the previous homepage wrapped every single card in its own
 * `<Reveal>`, and that was both a perf cost and visual noise.
 *
 * `staggerChildren` stays at 45ms: fast enough that a full grid finishes well
 * under half a second, slow enough to read as a deliberate wave.
 */
export function staggerContainer(stagger = 0.045, delayChildren = 0): Variants {
  return {
    hidden: {},
    visible: {
      transition: { staggerChildren: stagger, delayChildren },
    },
  };
}

export const listItem: Variants = {
  hidden: { opacity: 0, y: travel.sm },
  visible: { opacity: 1, y: 0, transition: transition.base },
};

/* -------------------------------------------------------------------------- */
/*  Interaction presets                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Hover/press presets. Kept here rather than inline so "a card lifts" means the
 * same distance and the same spring on every surface in the product.
 *
 * Values are deliberately small. The lift is 4px, not 12px: at display sizes a
 * big lift reads as a toy, and it also forces a large shadow to keep up.
 */
export const hover = {
  lift: { y: -4, transition: spring.soft },
  liftSm: { y: -2, transition: spring.crisp },
  press: { scale: 0.985, transition: spring.crisp },
  pressSm: { scale: 0.97, transition: spring.crisp },
  /** For icons that should nudge toward their direction of travel. */
  nudgeX: { x: 3, transition: spring.crisp },
} as const;

/* -------------------------------------------------------------------------- */
/*  Page transitions                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Route transition. Deliberately short and opacity-dominant: a page transition
 * that moves far or lasts long stops reading as polish and starts reading as
 * latency. 220ms in, and the outgoing state is never waited on.
 */
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: ease.emphasis, when: "beforeChildren" },
  },
};

/** Word-level headline reveal. Chars would blow up the DOM; words read better. */
export const wordReveal: Variants = {
  hidden: { opacity: 0, y: "0.4em" },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.055, ease: ease.emphasis },
  }),
};

/** Shared viewport config so every scroll reveal triggers at the same point. */
export const viewportOnce = { once: true, margin: "-72px" } as const;

/**
 * Collapses any variant to its final state. Call this when
 * `useReducedMotion()` is true: content still renders in place, it just
 * arrives without travelling.
 */
export function stillVariants(v: Variants): Variants {
  const visible = typeof v.visible === "object" ? v.visible : {};
  return { hidden: { ...visible, transition: { duration: 0 } }, visible };
}
