/** Höhe der Bottom-Nav-Leiste (ohne Safe-Area) — mobil; Desktop = 0. */
export const APP_MOBILE_BOTTOM_NAV_BAR_H = "3.5rem";

/**
 * Gesamt-Offset Unterkante inkl. Safe-Area (PWA-Home-Indicator).
 * Entspricht `--app-mobile-bottom-nav-offset` in `globals.css`.
 */
export const APP_MOBILE_BOTTOM_NAV_OFFSET =
  "var(--app-mobile-bottom-nav-offset)";

/**
 * Fixed FABs klar über der Bottom-Nav (mobil) bzw. nur Safe-Area (Desktop).
 * Höhe der Nav (3.5rem) + Safe-Area + Luftspalt — ohne Abhängigkeit nur vom
 * CSS-Var (falls der fällt, saß der Plus sonst im Sticky-Footer).
 */
export const appMobileFabBottomClassName =
  "bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px)+2rem)] md:bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))]";

/** Plus / Voice-FAB: mobil kompakter (`size-12`), Desktop unverändert `size-14`. */
export const appMobileFabButtonClassName =
  "flex size-12 items-center justify-center rounded-full shadow-lg md:size-14";

export const appMobileFabIconClassName = "size-5 md:size-6";
export const appMobileFabStopIconClassName = "size-4 fill-current md:size-5";

/**
 * Sticky Bars am Scroll-Unterrand: über der Bottom-Nav parken.
 */
export const appMobileStickyAboveBottomNavClassName =
  "max-md:bottom-[var(--app-mobile-bottom-nav-offset)]";
