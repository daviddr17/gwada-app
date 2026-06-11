"use client";

import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { GwadaFaviconIcon } from "@/components/icons/gwada-favicon-icon";
import { InstagramGlyph } from "@/components/icons/instagram-glyph";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import {
  NEWS_PLATFORM_LABELS,
  type NewsPlatform,
} from "@/lib/constants/news-platforms";
import { cn } from "@/lib/utils";

export function NewsPlatformIcon({
  platform,
  className,
  "aria-label": ariaLabel,
}: {
  platform: NewsPlatform;
  className?: string;
  "aria-label"?: string;
}) {
  const label = ariaLabel ?? NEWS_PLATFORM_LABELS[platform];

  return (
    <span
      className={cn("inline-flex shrink-0 items-center", className)}
      role="img"
      aria-label={label}
    >
      {platform === "google_business" ? (
        <GoogleGlyph className="size-4" />
      ) : platform === "facebook" ? (
        <FacebookGlyph className="size-4" />
      ) : platform === "instagram" ? (
        <InstagramGlyph className="size-4" />
      ) : platform === "whatsapp_channel" ? (
        <WhatsAppGlyph className="size-4" />
      ) : (
        <GwadaFaviconIcon size="chip" />
      )}
    </span>
  );
}
