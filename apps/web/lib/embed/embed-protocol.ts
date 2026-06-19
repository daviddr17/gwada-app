/** PostMessage-Protokoll zwischen Gwada-Embed (iframe) und Host-Seite. */

export const GWADA_EMBED_PROTOCOL_VERSION = 1;

export const GWADA_EMBED_MSG_RESIZE = "gwada:embed:resize" as const;

/** iframe → Host: Zielposition in iframe-Dokument (Kategorie-Sprung). */
export const GWADA_EMBED_MSG_SCROLL_TO = "gwada:embed:scroll-to" as const;

/** Host → iframe: sichtbare iframe-Position im Browser-Viewport. */
export const GWADA_EMBED_MSG_FRAME_VIEWPORT = "gwada:embed:frame-viewport" as const;

/** iframe → Host: Toolbar-Pin-Status (Host friert pinTop ein, kein Jitter). */
export const GWADA_EMBED_MSG_TOOLBAR_PIN = "gwada:embed:toolbar-pin" as const;

/** @deprecated Legacy-Snippet; Loader akzeptiert weiterhin diese Nachricht. */
export const GWADA_EMBED_MSG_RESIZE_LEGACY = "gwada-embed-resize" as const;

export type GwadaEmbedWidgetId =
  | "reservation"
  | "menu"
  | "reviews"
  | "news"
  | "events"
  | "opening_hours"
  | "contact";

export type GwadaEmbedResizeMessage = {
  type: typeof GWADA_EMBED_MSG_RESIZE;
  version: typeof GWADA_EMBED_PROTOCOL_VERSION;
  embedId: string;
  widget: GwadaEmbedWidgetId;
  height: number;
};

export type GwadaEmbedLegacyResizeMessage = {
  type: typeof GWADA_EMBED_MSG_RESIZE_LEGACY;
  height: number;
  embedId?: string;
};

export type GwadaEmbedScrollToMessage = {
  type: typeof GWADA_EMBED_MSG_SCROLL_TO;
  version: typeof GWADA_EMBED_PROTOCOL_VERSION;
  embedId: string;
  /** Abstand von iframe-Dokumentanfang bis Sektion. */
  offsetTop: number;
  stickyHeight: number;
};

export type GwadaEmbedFrameViewportMessage = {
  type: typeof GWADA_EMBED_MSG_FRAME_VIEWPORT;
  version: typeof GWADA_EMBED_PROTOCOL_VERSION;
  embedId: string;
  top: number;
  left: number;
  width: number;
  bottom: number;
  /** Obere Kante für Sticky (0 = Browser-Top, sonst z. B. App-Header). */
  pinTop?: number;
};

export type GwadaEmbedToolbarPinMessage = {
  type: typeof GWADA_EMBED_MSG_TOOLBAR_PIN;
  version: typeof GWADA_EMBED_PROTOCOL_VERSION;
  embedId: string;
  pinned: boolean;
};

export function isGwadaEmbedToolbarPinMessage(
  data: unknown,
): data is GwadaEmbedToolbarPinMessage {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return (
    o.type === GWADA_EMBED_MSG_TOOLBAR_PIN &&
    o.version === GWADA_EMBED_PROTOCOL_VERSION &&
    typeof o.embedId === "string" &&
    typeof o.pinned === "boolean"
  );
}

export function isGwadaEmbedScrollToMessage(
  data: unknown,
): data is GwadaEmbedScrollToMessage {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return (
    o.type === GWADA_EMBED_MSG_SCROLL_TO &&
    o.version === GWADA_EMBED_PROTOCOL_VERSION &&
    typeof o.embedId === "string" &&
    typeof o.offsetTop === "number" &&
    typeof o.stickyHeight === "number"
  );
}

export function isGwadaEmbedFrameViewportMessage(
  data: unknown,
): data is GwadaEmbedFrameViewportMessage {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return (
    o.type === GWADA_EMBED_MSG_FRAME_VIEWPORT &&
    o.version === GWADA_EMBED_PROTOCOL_VERSION &&
    typeof o.embedId === "string" &&
    typeof o.top === "number" &&
    typeof o.left === "number" &&
    typeof o.width === "number" &&
    typeof o.bottom === "number"
  );
}

export function isGwadaEmbedResizeMessage(
  data: unknown,
): data is GwadaEmbedResizeMessage {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return (
    o.type === GWADA_EMBED_MSG_RESIZE &&
    o.version === GWADA_EMBED_PROTOCOL_VERSION &&
    typeof o.embedId === "string" &&
    typeof o.widget === "string" &&
    typeof o.height === "number" &&
    o.height > 0
  );
}

export function isGwadaEmbedLegacyResizeMessage(
  data: unknown,
): data is GwadaEmbedLegacyResizeMessage {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return (
    o.type === GWADA_EMBED_MSG_RESIZE_LEGACY &&
    typeof o.height === "number" &&
    o.height > 0
  );
}
