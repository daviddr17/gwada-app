"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type FeedVideoTileProps = {
  src: string;
  className?: string;
  poster?: string | null;
};

/** Galerie-Video — nur abspielen wenn sichtbar (spart CPU/Decoder auf Mobil). */
export function FeedVideoTile({ src, className, poster }: FeedVideoTileProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void el.play().catch(() => undefined);
        } else {
          el.pause();
        }
      },
      { rootMargin: "64px", threshold: 0.15 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [src]);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster ?? undefined}
      className={cn("block aspect-video w-full object-cover", className)}
      muted
      loop
      playsInline
      preload="none"
    />
  );
}
