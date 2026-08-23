/** Höhe der Bottom-Nav-Leiste (ohne Safe-Area) — mobil; Desktop = 0. */
export const APP_MOBILE_BOTTOM_NAV_BAR_H = "3.5rem";

/** FAB-Durchmesser mobil (`size-12`) — entspricht `--app-mobile-fab-size`. */
export const APP_MOBILE_FAB_SIZE = "var(--app-mobile-fab-size, 3rem)";

/**
 * Safe-Area unten — Browser: `env()`; PWA standalone: Mindest-Pad in `app-mobile-chrome.css`.
 */
export const APP_MOBILE_BOTTOM_SAFE = "var(--app-mobile-bottom-safe)";

/** Gesamt-Offset Unterkante inkl. Safe-Area (Bottom-Nav). */
export const APP_MOBILE_BOTTOM_NAV_OFFSET =
  "var(--app-mobile-bottom-nav-offset)";

/** Unterkante des FAB-Stacks (über Bottom-Nav). */
export const APP_MOBILE_FAB_BOTTOM = "var(--app-mobile-fab-bottom)";

/** Scroll-Padding bis oberhalb FAB (Nav + Gap + Button). */
export const APP_MOBILE_FAB_CLEARANCE = "var(--app-mobile-fab-clearance)";

/** Nur Safe-Area (Drawer-Inhalt, Nav-Leiste). */
export const appMobileBottomSafePbClassName = "pb-[var(--app-mobile-bottom-safe)]";

/** Safe-Area + Mindest-Innenabstand (Sticky-Footer Desktop, Chat-Eingabe). */
export const appMobileBottomSafePbMdClassName =
  "pb-[max(0.75rem,var(--app-mobile-bottom-safe))]";

/** Safe-Area + größerer Mindest-Innenabstand (Formular-Fußzeilen). */
export const appMobileBottomSafePbLgClassName =
  "pb-[max(1.25rem,var(--app-mobile-bottom-safe))]";

/** Fixed FABs über der Bottom-Nav (mobil) bzw. Safe-Area (Desktop ab lg). */
export const appMobileFabBottomClassName =
  "bottom-[var(--app-mobile-fab-bottom)] lg:bottom-[max(1.25rem,var(--app-mobile-bottom-safe))]";

/** Schwebende Sprach-Caption über dem FAB (nicht dieselbe `bottom`-Zeile). */
export const appMobileFabCaptionBottomClassName =
  "bottom-[calc(var(--app-mobile-fab-bottom)+var(--app-mobile-fab-size)+0.5rem)] lg:bottom-[max(calc(1.25rem+var(--app-mobile-fab-size,3rem)),var(--app-mobile-bottom-safe))]";

/** Innen-Padding unten im Scroll-Inhalt (zusätzlich zum Scroll-Root-Offset). */
export const appMobileContentPbClassName =
  "max-lg:pb-[var(--app-mobile-content-pb,1rem)] lg:pb-16";

/** Plus / Voice-FAB: mobil kompakter (`size-12`), Desktop unverändert `size-14`. */
export const appMobileFabButtonClassName =
  "flex size-12 items-center justify-center rounded-full shadow-lg lg:size-14";

export const appMobileFabIconClassName = "size-5 lg:size-6";
export const appMobileFabStopIconClassName = "size-4 fill-current lg:size-5";

/** Sticky Bars: über der Bottom-Nav parken (FAB-Ausweichung per CSS `:has`). */
export const appMobileStickyAboveBottomNavClassName =
  "max-lg:bottom-[var(--app-mobile-bottom-nav-offset)]";
