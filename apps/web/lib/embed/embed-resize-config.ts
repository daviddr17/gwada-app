/** Debounce zwischen iframe-Messungen (ResizeObserver-Sturm dämpfen). */
export const EMBED_RESIZE_DEBOUNCE_MS = 48;

/** Nachlauf-Messungen nach Mount (Fonts, Bilder, Layout). */
export const EMBED_RESIZE_FOLLOWUP_MS = [80, 320, 720] as const;

/** Feed-Widgets: längeres Debounce — weniger Host-Reflows beim Bild-Nachladen. */
export const EMBED_FEED_RESIZE_DEBOUNCE_MS = 200;

/**
 * Host-iframe: CSS-Transition für Höhenwechsel (Twitter-ähnlich).
 * Nur für kompakte Widgets (Reservierung) — nie für Feed/News (Reflow-Sturm).
 */
export const EMBED_HOST_HEIGHT_TRANSITION =
  "height 0.24s cubic-bezier(0.33, 1, 0.68, 1)";

/** Host: Debounce bevor iframe-Höhe gesetzt wird. */
export const EMBED_HOST_RESIZE_DEBOUNCE_MS = 40;

/** Host Feed: Debounce bevor iframe-Höhe gesetzt wird. */
export const EMBED_HOST_FEED_RESIZE_DEBOUNCE_MS = 200;

/** Höhen-Deltas darunter ignorieren (Subpixel / Fonts). */
export const EMBED_HEIGHT_IGNORE_DELTA_PX = 6;

/** Puffer gegen 1px-Scrollbalken durch Subpixel-Rundung (content-Resize). */
export const EMBED_CONTENT_HEIGHT_BUFFER_PX = 2;

/** Feste iframe-Höhe während Story-Viewer im Embed (nicht volle Feed-Höhe). */
export const EMBED_NEWS_STORY_VIEWPORT_PX = 560;
