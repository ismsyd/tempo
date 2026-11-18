import type { Transition } from "motion/react";

/** Matches Figma motion: ease-out for entrances, back-out for chart growth. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;
export const EASE_BACK = [0.34, 1.4, 0.64, 1] as const;

export const fadeUp = (delay = 0, y = 16, duration = 0.6): {
  initial: { opacity: number; y: number };
  whileInView: { opacity: number; y: number };
  viewport: { once: boolean; margin: string };
  transition: Transition;
} => ({
  initial: { opacity: 0, y },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "0px 0px -40px 0px" },
  transition: { duration, delay, ease: EASE_OUT },
});

/** Viewport options for scroll-triggered chart animations. */
export const chartViewport = { once: true, margin: "0px 0px -80px 0px" } as const;

export const spring = { type: "spring", stiffness: 520, damping: 34, mass: 0.8 } as const;
