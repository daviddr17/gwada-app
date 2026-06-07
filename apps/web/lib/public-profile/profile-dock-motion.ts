import type { Transition } from "framer-motion";

/** Gleitender Hover-/Aktiv-Indikator im Icon-Dock (iOS-26-ähnlich) */
export const IOS_DOCK_HIGHLIGHT_TRANSITION: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 38,
  mass: 0.72,
};

export const PROFILE_DOCK_ICON_SLOT_PX = 48;
export const PROFILE_DOCK_ICON_GAP_PX = 4;
export const PROFILE_DOCK_ICON_HIGHLIGHT_PX = 44;

export function profileDockIconHighlightX(index: number) {
  const step = PROFILE_DOCK_ICON_SLOT_PX + PROFILE_DOCK_ICON_GAP_PX;
  const inset = (PROFILE_DOCK_ICON_SLOT_PX - PROFILE_DOCK_ICON_HIGHLIGHT_PX) / 2;
  return index * step + inset;
}
