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

/** Snappy pager snap after horizontal swipe */
export const IOS_APP_PAGER_SNAP_TRANSITION: Transition = {
  type: "spring",
  stiffness: 920,
  damping: 82,
  mass: 0.34,
  restDelta: 0.001,
  restSpeed: 40,
};

/** Dock tap / programmatic pager move */
export const IOS_APP_PAGER_SWITCH_TRANSITION: Transition = {
  type: "spring",
  stiffness: 820,
  damping: 78,
  mass: 0.38,
  restDelta: 0.001,
  restSpeed: 40,
};

export const IOS_APP_SWITCH_TRANSITION: Transition = {
  duration: 0.38,
  ease: APPLE_EASE,
};

/** Modul-Titel im Profil-Sheet-Header — weicher Crossfade */
export const PROFILE_MODULE_LABEL_TRANSITION: Transition = {
  duration: 0.34,
  ease: APPLE_EASE,
};

export const profileModuleLabelVariants: Variants = {
  enter: {
    opacity: 0,
    y: 6,
  },
  center: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    y: -6,
  },
};

/** Speisekarte im Profil — kein transform (sonst kein CSS-sticky für Toolbar). */
export const PROFILE_MODULE_FADE_TRANSITION: Transition = {
  duration: 0.32,
  ease: APPLE_EASE,
};

export const profileModuleFadeVariants: Variants = {
  enter: {
    opacity: 0,
    zIndex: 2,
  },
  center: {
    opacity: 1,
    zIndex: 1,
  },
  exit: {
    opacity: 0,
    zIndex: 1,
    position: "absolute",
    width: "100%",
  },
};

/** Full-width horizontal push — sheet content only */
export const iosAppHorizontalPushVariants: Variants = {
  enter: (direction: number) => ({
    x: `${direction * 100}%`,
    zIndex: 2,
  }),
  center: {
    x: 0,
    zIndex: 1,
  },
  exit: (direction: number) => ({
    x: `${direction * -100}%`,
    zIndex: 1,
  }),
};

export function profileAppSwitchDirection(
  appIds: readonly string[],
  fromAppId: string,
  toAppId: string,
): number {
  const prevIdx = appIds.indexOf(fromAppId);
  const nextIdx = appIds.indexOf(toAppId);
  if (prevIdx >= 0 && nextIdx >= 0 && prevIdx !== nextIdx) {
    return nextIdx > prevIdx ? 1 : -1;
  }
  return 0;
}

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
