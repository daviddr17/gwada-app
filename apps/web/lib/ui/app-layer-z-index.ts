/**
 * App-weite Z-Index-Skala (niedrig → hoch).
 *
 * Mobile Menü/Suche/Meldungen: Sheet unter der Sticky-Bottom-Nav
 * (`mobileChromeOverlay` < `mobileBottomNav`), damit Dismiss unter dem Dock
 * durchfährt statt am Clip-Rand zu schnappen.
 *
 * Tabellen-Vollbild (`AppFullscreenOverlay`) = 200.
 * Drawer/Dialog/Sheet darüber = 210, damit Belege/ToDos aus dem Overlay sichtbar bleiben.
 * Popover/Select in Drawern bleiben bei 320+ (siehe combobox/select).
 */
export const APP_LAYER_Z_INDEX = {
  chrome: 50,
  fab: 120,
  /** Menü / Suche / Meldungen — über FABs, unter Sticky-Bottom-Nav. */
  mobileChromeOverlay: 130,
  /** Thumb-Nav bleibt über dem Chrome-Sheet (X sichtbar, Sheet fährt darunter). */
  mobileBottomNav: 140,
  fullscreenOverlay: 200,
  /** Drawer, Dialog, Sheet — über Vollbild-Overlay und Route-Sweep. */
  stackedSurface: 210,
  /** Tooltips/Popover innerhalb des Tabellen-Vollbild-Overlays. */
  floatingInFullscreenOverlay: 205,
  drawerFloatingHost: 100,
  floatingInDrawer: 320,
} as const;

export const appLayerFullscreenOverlayZClassName = "z-[200]";
export const appLayerStackedSurfaceZClassName = "z-[210]";
export const appLayerFloatingInFullscreenOverlayZClassName = "z-[205]";

/** @deprecated Alias — bitte `APP_LAYER_Z_INDEX.fullscreenOverlay` nutzen. */
export const APP_FULLSCREEN_OVERLAY_Z_INDEX = APP_LAYER_Z_INDEX.fullscreenOverlay;

/** @deprecated Alias — bitte `APP_LAYER_Z_INDEX.stackedSurface` nutzen. */
export const APP_STACKED_SURFACE_Z_INDEX = APP_LAYER_Z_INDEX.stackedSurface;
