"use client";

import { useEffect, useMemo } from "react";
import {
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
) {
  const rounded = Math.ceil(height);
  if (rounded <= 0) return;

  const payload = embedId
    ? {
        type: GWADA_EMBED_MSG_RESIZE,
        version: GWADA_EMBED_PROTOCOL_VERSION,
        embedId,
        widget,
        height: rounded,
      }
    : {
        type: GWADA_EMBED_MSG_RESIZE_LEGACY,
        height: rounded,
      };

  window.parent.postMessage(payload, "*");

  if (embedId) {
    window.parent.postMessage(
      {
        type: GWADA_EMBED_MSG_RESIZE_LEGACY,
        height: rounded,
        embedId,
      },
      "*",
    );
  }
}

/** Meldet die Embed-Höhe an die einbettende Seite (gwada.js). */
export function EmbedResizeReporter({
  deps,
  widget: widgetProp,
  resizeMode = "content",
  viewportHeightPx,
}: {
  deps: unknown[];
  widget?: GwadaEmbedWidgetId;
  /** `viewport`: feste iframe-Höhe (interner Scroll). `content`: wächst mit Inhalt. */
  resizeMode?: "content" | "viewport";
  viewportHeightPx?: number;
}) {
  const ctx = useMemo(() => readEmbedContext(), []);
  const widget = widgetProp ?? ctx.widget;
  const embedId = ctx.embedId;

  useEffect(() => {
    const root = document.getElementById("gwada-embed-root");
    const measureTarget = root ?? document.body;

    let lastPosted = 0;
    let debounceTimer = 0;
    let raf = 0;

    const measureAndSend = (immediate: boolean) => {
      const run = () => {
        const height = measureEmbedContentHeight(
          measureTarget,
          resizeMode,
          viewportHeightPx,
        );
        const rounded = Math.ceil(height);
        if (rounded <= 0 || rounded === lastPosted) return;
        lastPosted = rounded;
        postEmbedHeight(rounded, embedId, widget);
      };

      window.cancelAnimationFrame(raf);
      window.clearTimeout(debounceTimer);

      if (immediate) {
        raf = window.requestAnimationFrame(run);
        return;
      }

      debounceTimer = window.setTimeout(() => {
        raf = window.requestAnimationFrame(run);
      }, EMBED_RESIZE_DEBOUNCE_MS);
    };

    measureAndSend(true);

    let ro: ResizeObserver | null = null;
    if (resizeMode === "content") {
      ro = new ResizeObserver(() => measureAndSend(false));
      ro.observe(measureTarget);
    }

    const followupTimers = EMBED_RESIZE_FOLLOWUP_MS.map((ms) =>
      window.setTimeout(() => measureAndSend(true), ms),
    );

    return () => {
      ro?.disconnect();
      window.cancelAnimationFrame(raf);
      window.clearTimeout(debounceTimer);
      for (const id of followupTimers) window.clearTimeout(id);
    };
  }, [deps, embedId, widget, resizeMode, viewportHeightPx]);

  return null;
}
