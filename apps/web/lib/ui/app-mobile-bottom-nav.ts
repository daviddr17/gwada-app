/** Höhe der Bottom-Nav-Leiste (ohne Safe-Area) — mobil; Desktop = 0. */
export const APP_MOBILE_BOTTOM_NAV_BAR_H = "3.5rem";

/**
 * Fixed FABs über der Bottom-Nav (mobil) bzw. nur Safe-Area (Desktop).
 * Nutzt `--app-mobile-bottom-nav-bar` aus `globals.css`.
 */
export const appMobileFabBottomClassName =
  "bottom-[calc(var(--app-mobile-bottom-nav-bar)+max(1.25rem,env(safe-area-inset-bottom)))]";

/**
 * Sticky Bars am Scroll-Unterrand: über der Bottom-Nav parken.
 */
export const appMobileStickyAboveBottomNavClassName =
  "max-md:bottom-[calc(var(--app-mobile-bottom-nav-bar)+env(safe-area-inset-bottom,0px))]";
