/** Höhe der Bottom-Nav-Leiste (ohne Safe-Area) — mobil; Desktop = 0. */
export const APP_MOBILE_BOTTOM_NAV_BAR_H = "3.5rem";

/**
 * Gesamt-Offset Unterkante inkl. Safe-Area (PWA-Home-Indicator).
 * Entspricht `--app-mobile-bottom-nav-offset` in `globals.css`.
 */
export const APP_MOBILE_BOTTOM_NAV_OFFSET =
  "var(--app-mobile-bottom-nav-offset)";

/**
 * Fixed FABs über der Bottom-Nav (mobil) bzw. nur Safe-Area (Desktop).
 * `--app-mobile-bottom-nav-offset` + Luftspalt; z-Index bleibt `APP_LAYER_Z_INDEX.fab`
 * (über Bottom-Nav `z-40`, unter Overlays).
 */
export const appMobileFabBottomClassName =
  "bottom-[calc(var(--app-mobile-bottom-nav-offset,0px)+1.5rem)] md:bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))]";

/**
 * Sticky Bars am Scroll-Unterrand: über der Bottom-Nav parken.
 */
export const appMobileStickyAboveBottomNavClassName =
  "max-md:bottom-[var(--app-mobile-bottom-nav-offset)]";
