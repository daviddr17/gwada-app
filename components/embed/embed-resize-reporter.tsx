"use client";

import { useEffect } from "react";

/** Meldet die Dokumenthöhe an die einbettende Seite (iframe-Resize). */
export function EmbedResizeReporter({ deps }: { deps: unknown[] }) {
  useEffect(() => {
    const post = () => {
      const height = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
      );
      window.parent.postMessage(
        { type: "gwada-embed-resize", height },
        "*",
      );
    };
    post();
    const ro = new ResizeObserver(() => post());
    ro.observe(document.body);
    const t = window.setTimeout(post, 80);
    return () => {
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, deps);

  return null;
}
