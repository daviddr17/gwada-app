import type { Transition, Variants } from "framer-motion";
import { APPLE_EASE } from "@/lib/public-profile/profile-tab-transition";

export const IOS_APP_OPEN_TRANSITION: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 38,
  mass: 0.82,
};

/** Slightly softer spring when morphing back to the launcher icon */
export const IOS_APP_CLOSE_TRANSITION: Transition = {
  type: "spring",
  stiffness: 340,
  damping: 44,
  mass: 0.92,
};

export const IOS_APP_LAYOUT_TRANSITION: Transition = {
  layout: IOS_APP_OPEN_TRANSITION,
};

export const IOS_APP_LAYOUT_CLOSE_TRANSITION: Transition = {
  layout: IOS_APP_CLOSE_TRANSITION,
};

export const IOS_APP_DRAG_SNAP_BACK_TRANSITION: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 42,
  mass: 0.75,
};

export const IOS_APP_SWITCH_TRANSITION: Transition = {
  duration: 0.38,
  ease: APPLE_EASE,
};

/** Full-width horizontal push — sheet content only */
export const iosAppHorizontalPushVariants: Variants = {
  enter: (direction: number) => ({
    x: `${direction * 100}%`,
  }),
  center: {
    x: 0,
  },
  exit: (direction: number) => ({
    x: `${direction * -100}%`,
  }),
};

export const iosAppSwitchVariants: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction * 36,
    scale: 0.96,
  }),
  center: {
    opacity: 1,
    x: 0,
    scale: 1,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -28,
    scale: 0.98,
  }),
};

export const iosHomeBackdropVariants: Variants = {
  home: { opacity: 1 },
  app: { opacity: 0.45 },
};

export const iosLauncherIconVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.88 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: 0.04 + i * 0.05,
      duration: 0.45,
      ease: APPLE_EASE,
    },
  }),
};
