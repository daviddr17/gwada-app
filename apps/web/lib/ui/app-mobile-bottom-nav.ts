/** Höhe der Bottom-Nav-Leiste (ohne Safe-Area) — mobil; Desktop = 0. */
export const APP_MOBILE_BOTTOM_NAV_BAR_H = "3.5rem";

/**
 * PWA-Safe-Area unten inkl. Mindest-Padding (0.5rem), wenn `env()` 0 liefert.
 * Entspricht `--app-mobile-bottom-safe` in `globals.css` (mobil gesetzt).
 */
export const APP_MOBILE_BOTTOM_SAFE = "var(--app-mobile-bottom-safe)";

/**
 * Gesamt-Offset Unterkante inkl. Safe-Area (PWA-Home-Indicator).
 * Entspricht `--app-mobile-bottom-nav-offset` in `globals.css`.
 */
export const APP_MOBILE_BOTTOM_NAV_OFFSET =
  "var(--app-mobile-bottom-nav-offset)";

/** Nur Safe-Area (Drawer-Inhalt, Nav-Leiste). */
export const appMobileBottomSafePbClassName = "pb-[var(--app-mobile-bottom-safe)]";

/** Safe-Area + Mindest-Innenabstand (Sticky-Footer, Chat-Eingabe). */
export const appMobileBottomSafePbMdClassName =
  "pb-[max(0.75rem,var(--app-mobile-bottom-safe))]";

/** Safe-Area + größerer Mindest-Innenabstand (Formular-Fußzeilen). */
export const appMobileBottomSafePbLgClassName =
  "pb-[max(1.25rem,var(--app-mobile-bottom-safe))]";

/**
 * Fixed FABs klar über der Bottom-Nav (mobil) bzw. nur Safe-Area (Desktop).
 * Nutzt `--app-mobile-bottom-safe` statt rohem `env()` (PWA-Standalone oft 0).
 */
export const appMobileFabBottomClassName =
  "bottom-[calc(var(--app-mobile-bottom-nav-bar,3.5rem)+var(--app-mobile-bottom-safe,0.5rem)+2rem)] md:bottom-[max(1.25rem,var(--app-mobile-bottom-safe))]";

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
