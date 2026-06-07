"use client";

import { Mail, MessageCircle } from "lucide-react";
import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { InstagramGlyph } from "@/components/icons/instagram-glyph";
import { GwadaFaviconIcon } from "@/components/icons/gwada-favicon-icon";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import {
  CONTACT_MESSAGE_PLATFORM_LABELS,
  type ContactMessagePlatform,
} from "@/lib/constants/contact-message-platforms";
import { cn } from "@/lib/utils";

function PlatformIcon({
  platform,
  className,
}: {
  platform: ContactMessagePlatform;
  className?: string;
}) {
  switch (platform) {
    case "whatsapp":
      return <WhatsAppGlyph className={cn("text-[#25D366]", className)} />;
    case "email":
      return <Mail className={cn("size-4", className)} aria-hidden />;
    case "facebook":
      return <FacebookGlyph className={cn("size-4", className)} />;
    case "instagram":
      return <InstagramGlyph className={cn("size-4", className)} />;
    case "gwada":
      return <GwadaFaviconIcon size="chip" className={className} />;
    default:
      return (
        <MessageCircle
          className={cn("size-4 text-muted-foreground", className)}
          aria-hidden
        />
      );
  }
}

export function ContactMessagePlatformChip({
  platform,
  selected,
  onSelect,
  disabled,
}: {
  platform: ContactMessagePlatform;
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
      {CONTACT_MESSAGE_PLATFORM_LABELS[platform]}
    </button>
  );
}

const META_ICON_CLASS =
  "size-2.5 shrink-0 opacity-55 [&_img]:opacity-90";

function PlatformIconMeta({
  platform,
  className,
}: {
  platform: ContactMessagePlatform;
  className?: string;
}) {
  switch (platform) {
    case "whatsapp":
      return (
        <WhatsAppGlyph className={cn(META_ICON_CLASS, className)} />
      );
    case "email":
      return (
        <Mail className={cn(META_ICON_CLASS, className)} aria-hidden />
      );
    case "facebook":
      return <FacebookGlyph className={cn(META_ICON_CLASS, className)} />;
    case "instagram":
      return (
        <InstagramGlyph
          className={cn(META_ICON_CLASS, className)}
          gradId="ig-grad-meta"
        />
      );
    case "gwada":
      return (
        <GwadaFaviconIcon
          size="meta"
          className={cn(META_ICON_CLASS, className)}
        />
      );
    default:
      return (
        <MessageCircle
          className={cn(META_ICON_CLASS, "text-muted-foreground", className)}
          aria-hidden
        />
      );
  }
}

export function ContactMessagePlatformIcon({
  platform,
  className,
  variant = "default",
}: {
  platform: ContactMessagePlatform;
  className?: string;
  /** Kleiner, dezenter — Meta-Zeile unter Chat-Bubbles. */
  variant?: "default" | "meta";
}) {
  if (variant === "meta") {
    return <PlatformIconMeta platform={platform} className={className} />;
  }
  return <PlatformIcon platform={platform} className={className} />;
}
