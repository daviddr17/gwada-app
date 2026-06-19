"use client";

import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { GwadaFaviconIcon } from "@/components/icons/gwada-favicon-icon";
import { InstagramGlyph } from "@/components/icons/instagram-glyph";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import {
  EVENTS_PLATFORM_LABELS,
  type EventsPlatform,
} from "@/lib/constants/events-platforms";
import { cn } from "@/lib/utils";

export function EventsPlatformIcon({
  platform,
  className,
  "aria-label": ariaLabel,
}: {
  platform: EventsPlatform;
  className?: string;
  "aria-label"?: string;
}) {
  const label = ariaLabel ?? EVENTS_PLATFORM_LABELS[platform];
  const iconClass = cn("size-4 shrink-0", className);

  return (
    <span className="inline-flex shrink-0 items-center" role="img" aria-label={label}>
      {platform === "google_business" ? (
        <GoogleGlyph className={iconClass} />
      ) : platform === "facebook" ? (
        <FacebookGlyph className={iconClass} />
      ) : platform === "instagram" ? (
        <InstagramGlyph className={iconClass} />
      ) : platform === "whatsapp_channel" ? (
        <WhatsAppGlyph className={iconClass} />
      ) : (
        <GwadaFaviconIcon size="chip" className={className} />
      )}
    </span>
  );
}
