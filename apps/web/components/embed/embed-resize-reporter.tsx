"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  EMBED_CONTENT_HEIGHT_BUFFER_PX,
  EMBED_FEED_RESIZE_DEBOUNCE_MS,
  EMBED_HEIGHT_IGNORE_DELTA_PX,
  EMBED_RESIZE_DEBOUNCE_MS,
  EMBED_RESIZE_FOLLOWUP_MS,
} from "@/lib/embed/embed-resize-config";
import {
  GWADA_EMBED_MSG_RESIZE,
  GWADA_EMBED_MSG_RESIZE_LEGACY,
  GWADA_EMBED_PROTOCOL_VERSION,
  type GwadaEmbedWidgetId,
} from "@/lib/embed/embed-protocol";
import { measureEmbedContentHeight } from "@/lib/embed/measure-embed-content-height";

function readEmbedContext(): {
  embedId: string | null;
  widget: GwadaEmbedWidgetId;
} {
  if (typeof window === "undefined") {
    return { embedId: null, widget: "reservation" };
  }
  const params = new URLSearchParams(window.location.search);
  const embedId = params.get("gwada_embed_id");
  const widgetRaw = params.get("gwada_widget");
  const widget =
    widgetRaw === "menu" ||
    widgetRaw === "reviews" ||
    widgetRaw === "news" ||
    widgetRaw === "events" ||
    widgetRaw === "gallery" ||
    widgetRaw === "opening_hours" ||
    widgetRaw === "contact" ||
    widgetRaw === "reservation"
      ? widgetRaw
      : "reservation";
  return { embedId, widget };
}

function postEmbedHeight(
  height: number,
  embedId: string | null,
  widget: GwadaEmbedWidgetId,
  options?: { contentBuffer?: boolean },
) {
  const rounded =
    Math.ceil(height) +
    (options?.contentBuffer ? EMBED_CONTENT_HEIGHT_BUFFER_PX : 0);
  if (rounded <= 0) return;

  // Ein Protokoll-Message reicht — doppeltes Legacy + Neu verdoppelt Host-Arbeit.
  if (embedId) {
    window.parent.postMessage(
      {
        type: GWADA_EMBED_MSG_RESIZE,
        version: GWADA_EMBED_PROTOCOL_VERSION,
        embedId,
        widget,
        height: rounded,
      },
      "*",
    );
    return;
  }

  window.parent.postMessage(
    {
      type: GWADA_EMBED_MSG_RESIZE_LEGACY,
      height: rounded,
    },
    "*",
  );
}

/** Meldet die Embed-Höhe an die einbettende Seite (gwada.js). */
export function EmbedResizeReporter({
  deps,
  widget: widgetProp,
  resizeMode = "content",
  viewportHeightPx,
  layoutStable = true,
  feedDebounce = false,
}: {
  deps: unknown[];
  widget?: GwadaEmbedWidgetId;
  /** `viewport`: feste iframe-Höhe (interner Scroll). `content`: wächst mit Inhalt. */
  resizeMode?: "content" | "viewport";
  viewportHeightPx?: number;
  /** Feed-Bilder fertig — erst dann aggressive Nachlauf-Messungen. */
  layoutStable?: boolean;
  /** Längeres Debounce für News/Galerie (weniger Host-Jank beim Scrollen). */
  feedDebounce?: boolean;
}) {
  const ctx = useMemo(() => readEmbedContext(), []);
  const widget = widgetProp ?? ctx.widget;
  const embedId = ctx.embedId;
  const layoutStableRef = useRef(layoutStable);
  layoutStableRef.current = layoutStable;
  const lastPostedRef = useRef(0);
  const debounceMs = feedDebounce
    ? EMBED_FEED_RESIZE_DEBOUNCE_MS
    : EMBED_RESIZE_DEBOUNCE_MS;

  useEffect(() => {
    const root = document.getElementById("gwada-embed-root");
    const measureTarget = root ?? document.body;

    let debounceTimer = 0;
    let raf = 0;

    const publish = (rounded: number) => {
      if (rounded <= 0) return;
      const prev = lastPostedRef.current;
      if (prev > 0 && Math.abs(rounded - prev) < EMBED_HEIGHT_IGNORE_DELTA_PX) {
        return;
      }
      // Feed während Bild-Load: nur wachsen, nicht jedes Schrumpfen/Wackeln senden.
      if (feedDebounce && !layoutStableRef.current && prev > 0 && rounded < prev) {
        return;
      }
      lastPostedRef.current = rounded;
      postEmbedHeight(rounded, embedId, widget, {
        contentBuffer: resizeMode === "content",
      });
    };

    const measureAndSend = (immediate: boolean) => {
      const run = () => {
        // Bis Bilder da sind: keine RO-getriebenen Host-Reflows (nur Erstmessung).
        if (
          feedDebounce &&
          !layoutStableRef.current &&
          !immediate &&
          lastPostedRef.current > 0
        ) {
          return;
        }
        const height = measureEmbedContentHeight(
          measureTarget,
          resizeMode,
          viewportHeightPx,
        );
        publish(Math.ceil(height));
      };

      window.cancelAnimationFrame(raf);
      window.clearTimeout(debounceTimer);

      if (immediate) {
        raf = window.requestAnimationFrame(run);
        return;
      }

      debounceTimer = window.setTimeout(() => {
        raf = window.requestAnimationFrame(run);
      }, debounceMs);
    };

    measureAndSend(true);

    let ro: ResizeObserver | null = null;
    if (resizeMode === "content") {
      ro = new ResizeObserver(() => measureAndSend(false));
      ro.observe(measureTarget);
    }

    const followupTimers = layoutStableRef.current
      ? EMBED_RESIZE_FOLLOWUP_MS.map((ms) =>
          window.setTimeout(() => measureAndSend(true), ms),
        )
      : [];

    return () => {
      ro?.disconnect();
      window.cancelAnimationFrame(raf);
      window.clearTimeout(debounceTimer);
      for (const id of followupTimers) window.clearTimeout(id);
    };
  }, [deps, embedId, widget, resizeMode, viewportHeightPx, debounceMs, feedDebounce]);

  // Einmal nach „Bilder fertig“ nachmessen — nicht parallel zum RO-Sturm.
  useEffect(() => {
    if (!layoutStable || resizeMode !== "content" || !feedDebounce) return;
    const root = document.getElementById("gwada-embed-root");
    const measureTarget = root ?? document.body;
    let raf = 0;
    let debounceTimer = 0;
    const run = () => {
      const height = measureEmbedContentHeight(
        measureTarget,
        resizeMode,
        viewportHeightPx,
      );
      const rounded = Math.ceil(height);
      if (rounded <= 0) return;
      const prev = lastPostedRef.current;
      if (prev > 0 && Math.abs(rounded - prev) < EMBED_HEIGHT_IGNORE_DELTA_PX) {
        return;
      }
      lastPostedRef.current = rounded;
      postEmbedHeight(rounded, embedId, widget, { contentBuffer: true });
    };
    debounceTimer = window.setTimeout(() => {
      raf = window.requestAnimationFrame(run);
    }, EMBED_FEED_RESIZE_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(debounceTimer);
      window.cancelAnimationFrame(raf);
    };
  }, [layoutStable, embedId, widget, resizeMode, viewportHeightPx, feedDebounce]);

  return null;
}
