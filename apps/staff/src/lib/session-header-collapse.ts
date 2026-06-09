/** Scroll-driven collapse for the table session screen header. */
export const SESSION_HEADER_COLLAPSE = {
  /** Fade-in distance for mini KPI after stats block has scrolled off. */
  MINI_FADE: 40,
} as const;

/** Mini KPI opacity: hidden until stats block is off-screen, then quick fade-in. */
export function sessionMiniOpacity(scrollY: number, statsH: number): number {
  "worklet";
  if (statsH <= 0 || scrollY < statsH) return 0;
  const fade = (scrollY - statsH) / SESSION_HEADER_COLLAPSE.MINI_FADE;
  return Math.min(Math.max(fade, 0), 1);
}

/** Stats block opacity while scrolling under the tab chrome. */
export function sessionStatsOpacity(scrollY: number, statsH: number): number {
  "worklet";
  if (statsH <= 0) return 1;
  if (scrollY >= statsH) return 0;
  const fadeStart = statsH * 0.55;
  if (scrollY <= fadeStart) return 1;
  return 1 - (scrollY - fadeStart) / (statsH - fadeStart);
}
