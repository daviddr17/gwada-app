"use client";

import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { GwadaFaviconIcon } from "@/components/icons/gwada-favicon-icon";
import type { ReviewPlatform } from "@/lib/constants/review-platforms";
import { cn } from "@/lib/utils";

export function ReviewPlatformIcon({
  platform,
  className,
}: {
  platform: ReviewPlatform;
  className?: string;
}) {
  switch (platform) {
    case "google":
      return <GoogleGlyph className={cn("size-4 shrink-0", className)} />;
    case "facebook":
      return <FacebookGlyph className={cn("size-4 shrink-0", className)} />;
    case "gwada":
      return <GwadaFaviconIcon size="chip" className={className} />;
  }
}
