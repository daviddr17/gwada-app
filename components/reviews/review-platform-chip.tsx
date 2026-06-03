"use client";

import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { GwadaFaviconIcon } from "@/components/icons/gwada-favicon-icon";
import {
  REVIEW_PLATFORM_LABELS,
  type ReviewPlatform,
} from "@/lib/constants/review-platforms";
import { cn } from "@/lib/utils";

function PlatformIcon({
  platform,
  className,
}: {
  platform: ReviewPlatform;
  className?: string;
}) {
  switch (platform) {
    case "google":
      return <GoogleGlyph className={cn("size-4", className)} />;
    case "facebook":
      return <FacebookGlyph className={cn("size-4", className)} />;
    case "gwada":
      return <GwadaFaviconIcon size="chip" className={className} />;
  }
}

export function ReviewPlatformChip({
  platform,
  selected,
  onSelect,
  disabled,
}: {
  platform: ReviewPlatform;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        selected
          ? "border-accent/50 bg-accent/15 text-foreground"
          : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
        disabled && "pointer-events-none opacity-50",
      )}
      aria-pressed={selected}
    >
      <PlatformIcon platform={platform} />
      {REVIEW_PLATFORM_LABELS[platform]}
    </button>
  );
}
