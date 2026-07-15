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
 * Nutzt `--app-mobile-bottom-nav-offset` + festen Luftspalt (nicht max mit Safe-Area
 * — sonst sitzt der Plus-Button direkt auf der Nav und überdeckt Profil).
 */
export const appMobileFabBottomClassName =
  "bottom-[calc(var(--app-mobile-bottom-nav-offset)+1.5rem)]";

/**
 * Sticky Bars am Scroll-Unterrand: über der Bottom-Nav parken.
 */
export const appMobileStickyAboveBottomNavClassName =
  "max-md:bottom-[var(--app-mobile-bottom-nav-offset)]";
