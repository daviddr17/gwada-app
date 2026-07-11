"use client";

import { EmbedResizeReporter } from "@/components/embed/embed-resize-reporter";
import { useFeedLayoutStable } from "@/components/feed/feed-layout-stable-context";
import type { GwadaEmbedWidgetId } from "@/lib/embed/embed-protocol";

/** Embed-Resize mit Warten auf Feed-Bild-Layout (kein iframe-Springen). */
export function EmbedFeedResizeReporter({
  widget,
  deps,
  resizeMode = "content",
  viewportHeightPx,
}: {
  widget: GwadaEmbedWidgetId;
  deps: unknown[];
  resizeMode?: "content" | "viewport";
  viewportHeightPx?: number;
}) {
  const layoutStable = useFeedLayoutStable()?.stable ?? true;
  return (
    <EmbedResizeReporter
      widget={widget}
      deps={[...deps, layoutStable]}
      layoutStable={layoutStable}
      resizeMode={resizeMode}
      viewportHeightPx={viewportHeightPx}
    />
  );
}
