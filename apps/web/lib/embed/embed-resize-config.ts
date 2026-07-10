/** Debounce zwischen iframe-Messungen (ResizeObserver-Sturm dämpfen). */
export const EMBED_RESIZE_DEBOUNCE_MS = 48;

/** Nachlauf-Messungen nach Mount (Fonts, Bilder, Layout). */
export const EMBED_RESIZE_FOLLOWUP_MS = [80, 320, 720] as const;

/** Feed-Widgets: längeres Debounce bis Layout stabil. */
export const EMBED_FEED_RESIZE_DEBOUNCE_MS = 120;

/** Host-iframe: CSS-Transition für Höhenwechsel (Twitter-ähnlich). */
export const EMBED_HOST_HEIGHT_TRANSITION =
  "height 0.24s cubic-bezier(0.33, 1, 0.68, 1)";

/** Host: Debounce bevor iframe-Höhe gesetzt wird. */
export const EMBED_HOST_RESIZE_DEBOUNCE_MS = 40;
