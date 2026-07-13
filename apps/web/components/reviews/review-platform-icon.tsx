"use client";

import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { TripadvisorGlyph } from "@/components/icons/tripadvisor-glyph";
import { GwadaFaviconIcon } from "@/components/icons/gwada-favicon-icon";
import {
  REVIEW_PLATFORM_LABELS,
  type ReviewPlatform,
} from "@/lib/constants/review-platforms";
import { cn } from "@/lib/utils";

export function ReviewPlatformIcon({
  platform,
  className,
  "aria-label": ariaLabel,
}: {
  platform: ReviewPlatform;
  className?: string;
  "aria-label"?: string;
}) {
  const label = ariaLabel ?? REVIEW_PLATFORM_LABELS[platform];

  return (
    <span
      className={cn("inline-flex shrink-0 items-center", className)}
      role="img"
      aria-label={label}
    >
      {platform === "google" ? (
        <GoogleGlyph className="size-4" />
      ) : platform === "facebook" ? (
        <FacebookGlyph className="size-4" />
      ) : platform === "tripadvisor" ? (
        <TripadvisorGlyph className="size-4" />
      ) : (
        <GwadaFaviconIcon size="chip" />
      )}
    </span>
  );
}
