"use client";

import { useEffect, useRef, useState } from "react";
import { useFeedLayoutStable } from "@/components/feed/feed-layout-stable-context";
import {
  feedMediaDimensions,
  feedNewsDisplayAspectRatio,
} from "@/lib/feed/feed-media-layout";
import { cn } from "@/lib/utils";

type FeedMediaImageProps = {
  src: string;
  thumbSrc?: string | null;
  blurDataUrl?: string | null;
  width?: number | null;
  height?: number | null;
  alt?: string;
  className?: string;
  imgClassName?: string;
  fit?: "cover" | "contain";
  priority?: boolean;
  onLoad?: () => void;
  /**
   * Feed-Listen: nur Thumb/Preview laden — kein zweiter Full-Res-Fetch.
   * Deutlich weniger Decode- und Netzwerk-Last auf Mobil.
   */
  feedOptimized?: boolean;
  /** Galerie-Masonry: natürliche Bildhöhe statt festem Aspect-Slot. */
  naturalSize?: boolean;
  /** News: Seitenverhältnis auf Feed-Grenzen clampen (Instagram-ähnlich). */
  clampAspect?: boolean;
};

export function FeedMediaImage({
  src,
  thumbSrc,
  blurDataUrl,
  width,
  height,
  alt = "",
  className,
  imgClassName,
  fit = "cover",
  priority = false,
  onLoad,
  feedOptimized = false,
  naturalSize = false,
  clampAspect = false,
}: FeedMediaImageProps) {
  const layoutStable = useFeedLayoutStable();
  const dims = feedMediaDimensions(width, height);
  const aspectRatio = clampAspect
    ? feedNewsDisplayAspectRatio(width, height)
    : dims.aspectRatio;

  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [useFullRes, setUseFullRes] = useState(() => !feedOptimized && !thumbSrc);
  const [feedUseFull, setFeedUseFull] = useState(false);
  /** Galerie: Full-Res erst einblenden, wenn wirklich geladen (Thumb bleibt darunter). */
  const [fullOpaque, setFullOpaque] = useState(false);
  const resolvedSrc = feedOptimized
    ? feedUseFull
      ? src
      : (thumbSrc ?? src)
    : useFullRes
      ? src
      : (thumbSrc ?? src);

  const pendingRegisteredRef = useRef(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (naturalSize) return;
    loadedRef.current = false;
    pendingRegisteredRef.current = false;
    setLoaded(false);
    setLoadFailed(false);
    setUseFullRes(!feedOptimized && !thumbSrc);
    setFeedUseFull(false);
    layoutStable?.registerPending();
    pendingRegisteredRef.current = true;

    return () => {
      if (pendingRegisteredRef.current && !loadedRef.current) {
        layoutStable?.markLoaded();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ein Pending pro resolvedSrc
  }, [resolvedSrc, feedOptimized, naturalSize]);

  useEffect(() => {
    if (!naturalSize) return;
    loadedRef.current = false;
    pendingRegisteredRef.current = false;
    setLoaded(false);
    setLoadFailed(false);
    setFullOpaque(false);
    setUseFullRes(!feedOptimized && !thumbSrc?.trim());
    layoutStable?.registerPending();
    pendingRegisteredRef.current = true;

    return () => {
      if (pendingRegisteredRef.current && !loadedRef.current) {
        layoutStable?.markLoaded();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Pending pro Bild-URL-Paar
  }, [naturalSize, src, thumbSrc, feedOptimized]);

  const finishLoad = () => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      setLoaded(true);
      layoutStable?.markLoaded();
      onLoad?.();
      if (!feedOptimized && thumbSrc && !useFullRes) {
        setUseFullRes(true);
      }
      return;
    }
    if (!feedOptimized && useFullRes && thumbSrc) {
      onLoad?.();
    }
  };

  const handleError = () => {
    if (feedOptimized && !feedUseFull && thumbSrc && src !== thumbSrc) {
      loadedRef.current = false;
      setLoaded(false);
      setFeedUseFull(true);
      return;
    }
    if (!feedOptimized && useFullRes && thumbSrc && resolvedSrc === src) {
      loadedRef.current = false;
      setLoaded(false);
      setUseFullRes(false);
      return;
    }
    if (!loadedRef.current) {
      loadedRef.current = true;
      setLoadFailed(true);
      setLoaded(true);
      layoutStable?.markLoaded();
    }
  };

  const imgClasses = cn(
    fit === "cover" ? "object-cover" : "object-contain",
    !feedOptimized && "transition-opacity duration-300 ease-out",
    "absolute inset-0 size-full",
    !loadFailed && (loaded ? "opacity-100" : "opacity-0"),
    imgClassName,
  );

  /**
   * Galerie-Fotowand: Seitenverhältnis aus Metadaten reservieren (kein
   * Column-Reflow) + Thumb bleibt unter Full-Res (kein Remount-Flash).
   */
  if (naturalSize) {
    const thumb = thumbSrc?.trim() || null;
    const full = src.trim();
    const hasThumb = Boolean(thumb && thumb !== full);

    return (
      <div
        className={cn("relative w-full overflow-hidden bg-muted/40", className)}
        style={{ aspectRatio }}
      >
        {blurDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={blurDataUrl}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 size-full scale-110 object-cover blur-md"
          />
        ) : null}
        {hasThumb && !loadFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb!}
            alt={fullOpaque ? "" : alt}
            aria-hidden={fullOpaque || undefined}
            width={dims.width}
            height={dims.height}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => {
              finishLoad();
              if (!feedOptimized) setUseFullRes(true);
            }}
            onError={handleError}
            className={cn(
              fit === "cover" ? "object-cover" : "object-contain",
              "absolute inset-0 size-full",
              imgClassName,
            )}
          />
        ) : null}
        {!loadFailed && (!hasThumb || useFullRes) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={full}
            alt={alt}
            width={dims.width}
            height={dims.height}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => {
              setFullOpaque(true);
              finishLoad();
            }}
            onError={handleError}
            className={cn(
              fit === "cover" ? "object-cover" : "object-contain",
              "absolute inset-0 size-full transition-opacity duration-500 ease-out",
              hasThumb
                ? fullOpaque
                  ? "opacity-100"
                  : "opacity-0"
                : loaded
                  ? "opacity-100"
                  : "opacity-0",
              imgClassName,
            )}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-muted/40",
        !loaded && !blurDataUrl && !loadFailed && "skeleton-shimmer",
        className,
      )}
      style={{ aspectRatio }}
    >
      {blurDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={blurDataUrl}
          alt=""
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 size-full scale-110 object-cover blur-md",
            fit === "contain" && "object-contain",
          )}
        />
      ) : null}
      {!loadFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={resolvedSrc}
          src={resolvedSrc}
          alt={alt}
          width={dims.width}
          height={dims.height}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={finishLoad}
          onError={handleError}
          className={imgClasses}
        />
      ) : null}
    </div>
  );
}
