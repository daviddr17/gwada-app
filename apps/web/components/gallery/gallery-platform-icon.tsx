"use client";

import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { GwadaFaviconIcon } from "@/components/icons/gwada-favicon-icon";
import { InstagramGlyph } from "@/components/icons/instagram-glyph";
import { TripadvisorGlyph } from "@/components/icons/tripadvisor-glyph";
import {
  GALLERY_PLATFORM_LABELS,
  type GalleryPlatform,
} from "@/lib/constants/gallery-platforms";
import { cn } from "@/lib/utils";

export function GalleryPlatformIcon({
  platform,
  className,
  "aria-label": ariaLabel,
}: {
  platform: GalleryPlatform;
  className?: string;
  "aria-label"?: string;
}) {
  const label = ariaLabel ?? GALLERY_PLATFORM_LABELS[platform];
  const iconClass = cn("size-4 shrink-0", className);

  return (
    <span className="inline-flex shrink-0 items-center" role="img" aria-label={label}>
      {platform === "google_business" ? (
        <GoogleGlyph className={iconClass} />
      ) : platform === "facebook" ? (
        <FacebookGlyph className={iconClass} />
      ) : platform === "instagram" ? (
        <InstagramGlyph className={iconClass} />
      ) : platform === "tripadvisor" ? (
        <TripadvisorGlyph className={iconClass} />
      ) : (
        <GwadaFaviconIcon size="chip" className={className} />
      )}
    </span>
  );
}
