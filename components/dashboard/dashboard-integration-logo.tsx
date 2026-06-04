"use client";

import { useId } from "react";
import { Mail } from "lucide-react";
import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { InstagramGlyph } from "@/components/icons/instagram-glyph";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import type { DashboardIntegrationChannelId } from "@/lib/dashboard/dashboard-integration-channels";
import { cn } from "@/lib/utils";

export function DashboardIntegrationLogo({
  id,
  connected,
  className,
}: {
  id: DashboardIntegrationChannelId;
  connected: boolean;
  className?: string;
}) {
  const gradId = useId();
  const muted = !connected;

  const wrapClass = cn(
    "flex size-9 items-center justify-center rounded-lg border transition-[filter,opacity,border-color,background-color]",
    connected
      ? "border-border/50 bg-background shadow-sm"
      : "border-border/35 bg-muted/25",
    muted && "grayscale opacity-[0.42]",
    className,
  );

  const iconClass = "size-5 shrink-0";

  switch (id) {
    case "whatsapp":
      return (
        <div className={wrapClass}>
          <WhatsAppGlyph className={iconClass} />
        </div>
      );
    case "facebook":
      return (
        <div className={wrapClass}>
          <FacebookGlyph className={iconClass} />
        </div>
      );
    case "instagram":
      return (
        <div className={wrapClass}>
          <InstagramGlyph className={iconClass} gradId={gradId} />
        </div>
      );
    case "google_business":
      return (
        <div className={wrapClass}>
          <GoogleGlyph className={iconClass} />
        </div>
      );
    case "email":
      return (
        <div className={wrapClass}>
          <Mail
            className={cn(
              iconClass,
              connected ? "text-sky-600 dark:text-sky-400" : "text-muted-foreground",
            )}
            aria-hidden
          />
        </div>
      );
    default:
      return null;
  }
}
