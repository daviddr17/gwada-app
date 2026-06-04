import type { Transition, Variants } from "framer-motion";

/** iOS/macOS-typische Kurve — weich, ohne Bounce. */
export const APPLE_EASE = [0.32, 0.72, 0, 1] as const;

export const PROFILE_TAB_TRANSITION: Transition = {
  duration: 0.48,
  ease: APPLE_EASE,
};

export const PROFILE_TAB_EXIT_TRANSITION: Transition = {
  duration: 0.32,
  ease: APPLE_EASE,
};

export const profileTabPanelVariants: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction * 22,
    scale: 0.982,
  }),
  active: {
    opacity: 1,
    x: 0,
    scale: 1,
  },
  idle: {
    opacity: 0,
    x: 0,
    scale: 0.988,
    pointerEvents: "none" as const,
  },
};

/** Legacy exit für AnimatePresence-Fallback */
export const profileTabExitVariants: Variants = {
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -14,
    scale: 0.992,
  }),
};

export const profileTabContentVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      delayChildren: 0.04,
      staggerChildren: 0.04,
      ease: APPLE_EASE,
      duration: 0.38,
    },
  },
};

export const profileTabItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.36, ease: APPLE_EASE },
  },
};

export const profileTabReducedVariants: Variants = {
  enter: { opacity: 0 },
  active: { opacity: 1 },
  idle: { opacity: 0 },
};

export const profileSegmentSpring: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 42,
  mass: 0.65,
};
