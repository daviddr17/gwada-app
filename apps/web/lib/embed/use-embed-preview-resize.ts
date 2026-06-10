"use client";

import { useEffect, type RefObject } from "react";
import { applyEmbedHostFrameHeight } from "@/lib/embed/apply-embed-host-frame-height";
import { parseEmbedResizeHeight } from "@/lib/embed/parse-embed-resize-height";

/** Vorschau in Einbinden-Panels: gleiche smooth Höhenanpassung wie gwada.js. */
export function useEmbedPreviewResize(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  previewSrc: string,
) {
  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return;

    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow) return;
      const height = parseEmbedResizeHeight(event.data);
      if (height == null) return;
      applyEmbedHostFrameHeight(frame, height);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [iframeRef, previewSrc]);
}
