"use client";

import { useEffect, useMemo } from "react";
import {
  GWADA_EMBED_MSG_RESIZE,
  GWADA_EMBED_MSG_RESIZE_LEGACY,
  GWADA_EMBED_PROTOCOL_VERSION,
  type GwadaEmbedWidgetId,
} from "@/lib/embed/embed-protocol";

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
    widgetRaw === "contact" ||
    widgetRaw === "reservation"
      ? widgetRaw
      : "reservation";
  return { embedId, widget };
}

/** Meldet die Embed-Höhe an die einbettende Seite (gwada.js oder Legacy-Script). */
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

    const post = () => {
      const height =
        resizeMode === "viewport"
          ? Math.ceil(viewportHeightPx ?? 640)
          : Math.max(
              measureTarget.scrollHeight,
              measureTarget.getBoundingClientRect().height,
              document.documentElement.scrollHeight,
            );
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
    };

    post();
    let ro: ResizeObserver | null = null;
    if (resizeMode === "content") {
      ro = new ResizeObserver(() => post());
      ro.observe(measureTarget);
    }
    const t1 = window.setTimeout(post, 80);
    const t2 = window.setTimeout(post, 400);
    return () => {
      ro?.disconnect();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [deps, embedId, widget, resizeMode, viewportHeightPx]);

  return null;
}
