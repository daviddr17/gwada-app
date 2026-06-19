"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  EMBED_PREVIEW_TEXT_THEME_PARAM,
  type EmbedAppearanceWidget,
  type EmbedTextTheme,
} from "@/lib/embed/embed-appearance";
import { attachEmbedHostBridge } from "@/lib/embed/embed-host-bridge";
import { useEmbedPreviewResize } from "@/lib/embed/use-embed-preview-resize";
import { cn } from "@/lib/utils";

const PREVIEW_THEMES: { theme: EmbedTextTheme; label: string }[] = [
  { theme: "dark", label: "Dunkle Schrift" },
  { theme: "light", label: "Helle Schrift" },
];

/** Schachbrett — Embed-Hintergrund ist transparent; Muster nur in der Admin-Vorschau. */
export const embedPreviewTransparencyBackgroundClassName =
  "bg-[#ececec] [background-image:linear-gradient(45deg,#d0d0d0_25%,transparent_25%),linear-gradient(-45deg,#d0d0d0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#d0d0d0_75%),linear-gradient(-45deg,transparent_75%,#d0d0d0_75%)] [background-size:12px_12px] [background-position:0_0,0_6px,6px_-6px,-6px_0] dark:bg-[#262626] dark:[background-image:linear-gradient(45deg,#383838_25%,transparent_25%),linear-gradient(-45deg,#383838_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#383838_75%),linear-gradient(-45deg,transparent_75%,#383838_75%)]";

export function embedDualThemePreviewHostBackgroundClass(textTheme: EmbedTextTheme) {
  return textTheme === "light" ? "bg-neutral-900" : "bg-muted/30";
}

function embedPreviewPaneCaption(textTheme: EmbedTextTheme, label: string) {
  const simulatedHost =
    textTheme === "light" ? "dunkler Website-Hintergrund" : "heller Website-Hintergrund";
  return `${label} · transparenter Embed (Vorschau: ${simulatedHost})`;
}

export function EmbedDualThemePreviewPane({
  textTheme,
  label,
  children,
  className,
}: {
  textTheme: EmbedTextTheme;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const caption = embedPreviewPaneCaption(textTheme, label);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/50",
        embedPreviewTransparencyBackgroundClassName,
        className,
      )}
    >
      <p
        className="border-b border-border/40 bg-background/90 px-3 py-2 text-xs font-medium text-muted-foreground backdrop-blur-sm"
        title="Der eingebettete Widget-Hintergrund ist transparent. Die Vorschau simuliert den Hintergrund der Website, damit die Schrift lesbar bleibt."
      >
        {caption}
      </p>
      <div className="min-h-0 p-2">
        <div
          className={cn(
            "min-h-0 overflow-hidden rounded-lg",
            embedDualThemePreviewHostBackgroundClass(textTheme),
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function EmbedPreviewIframe({
  embedUrl,
  widget,
  textTheme,
  title,
  minHeight,
}: {
  embedUrl: string;
  widget: EmbedAppearanceWidget;
  textTheme: EmbedTextTheme;
  title: string;
  minHeight: number;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);
  const embedId = `gwada-${widget}-embed-preview-${textTheme}`;

  useEffect(() => {
    setMounted(true);
  }, []);

  const previewSrc = useMemo(() => {
    if (!mounted) return embedUrl;
    const url = new URL(embedUrl, window.location.origin);
    url.searchParams.set("gwada_embed_id", embedId);
    url.searchParams.set("gwada_widget", widget);
    url.searchParams.set(EMBED_PREVIEW_TEXT_THEME_PARAM, textTheme);
    return url.toString();
  }, [embedId, embedUrl, mounted, textTheme, widget]);

  useEmbedPreviewResize(iframeRef, previewSrc);

  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    return attachEmbedHostBridge(frame, window.location.origin);
  }, [previewSrc]);

  return (
    <iframe
      ref={iframeRef}
      id={embedId}
      src={previewSrc}
      title={`${title} — ${textTheme === "light" ? "helle Schrift" : "dunkle Schrift"}`}
      className="block w-full border-0"
      style={{ minHeight }}
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

export function EmbedDualThemePreviewFrame({
  embedUrl,
  widget,
  title,
  minHeight = 480,
  className,
}: {
  embedUrl: string;
  widget: EmbedAppearanceWidget;
  title: string;
  minHeight?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 lg:grid-cols-2", className)}>
      {PREVIEW_THEMES.map(({ theme, label }) => (
        <EmbedDualThemePreviewPane key={theme} textTheme={theme} label={label}>
          <EmbedPreviewIframe
            embedUrl={embedUrl}
            widget={widget}
            textTheme={theme}
            title={title}
            minHeight={minHeight}
          />
        </EmbedDualThemePreviewPane>
      ))}
    </div>
  );
}
