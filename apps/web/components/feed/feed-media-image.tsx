"use client";

import { useEffect, useState } from "react";
import { useFeedLayoutStable } from "@/components/feed/feed-layout-stable-context";
import { feedMediaDimensions } from "@/lib/feed/feed-media-layout";
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
}: FeedMediaImageProps) {
  const layoutStable = useFeedLayoutStable();
  const { aspectRatio } = feedMediaDimensions(width, height);
  const [loaded, setLoaded] = useState(false);
  const [useFullRes, setUseFullRes] = useState(!thumbSrc);
  const displaySrc = useFullRes ? src : (thumbSrc ?? src);

  useEffect(() => {
    setLoaded(false);
    setUseFullRes(!thumbSrc);
    layoutStable?.registerPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ein Pending pro src
  }, [src, thumbSrc]);

  const finishLoad = () => {
    if (!loaded) {
      setLoaded(true);
      layoutStable?.markLoaded();
      onLoad?.();
      if (thumbSrc && !useFullRes) {
        setUseFullRes(true);
      }
      return;
    }
    if (useFullRes && thumbSrc) {
      onLoad?.();
    }
  };

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
          className={cn(
            "pointer-events-none absolute inset-0 size-full scale-110 object-cover blur-md",
            fit === "contain" && "object-contain",
          )}
        />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={displaySrc}
        src={displaySrc}
        alt={alt}
        width={width ?? undefined}
        height={height ?? undefined}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={finishLoad}
        onError={() => {
          if (!loaded) {
            setLoaded(true);
            layoutStable?.markLoaded();
          }
        }}
        className={cn(
          "absolute inset-0 size-full transition-opacity duration-500 ease-out",
          fit === "cover" ? "object-cover" : "object-contain",
          loaded ? "opacity-100" : "opacity-0",
          imgClassName,
        )}
      />
    </div>
  );
}
