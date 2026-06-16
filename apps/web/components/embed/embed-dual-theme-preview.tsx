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

export function embedDualThemePreviewBackgroundClass(textTheme: EmbedTextTheme) {
  return textTheme === "light" ? "bg-neutral-900" : "bg-muted/30";
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
  const onDarkBackground = textTheme === "light";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/50",
        embedDualThemePreviewBackgroundClass(textTheme),
        className,
      )}
    >
      <p
        className={cn(
          "border-b border-border/40 px-3 py-2 text-xs font-medium",
          onDarkBackground
            ? "bg-neutral-800/90 text-neutral-300"
            : "bg-card/80 text-muted-foreground",
        )}
      >
        {label}
        {onDarkBackground ? " · dunkler Hintergrund" : " · heller Hintergrund"}
      </p>
      <div className="min-h-0">{children}</div>
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
