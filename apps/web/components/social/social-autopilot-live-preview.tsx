"use client";

import { SocialTemplatePreview } from "@/components/social/social-template-preview";
import type { SocialBrandKit } from "@/lib/social/social-brand-kit";
import {
  previewLayoutFromBrandKit,
  publishPlatformsSummary,
  sampleCaptionFromBrandKit,
  sampleTitleFromBrandKit,
} from "@/lib/social/social-autopilot-sample-preview";
import { SOCIAL_PHOTO_LOOK_LABELS } from "@/lib/social/social-brand-kit";
import { cn } from "@/lib/utils";

/**
 * Eine Live-Vorschau für Autopilot-Einstellungen —
 * reagiert sofort auf Ton, Stimme, CTA, Hashtags, Palette, Look, Layouts, Kanäle.
 * Kein LLM / kein echter Post.
 */
export function SocialAutopilotLivePreview({
  kit,
  restaurantName = "Euer Restaurant",
  badge,
  className,
}: {
  kit: SocialBrandKit;
  restaurantName?: string;
  /** z. B. „Vorschlag“ während Aus-Social-Entwurf */
  badge?: string | null;
  className?: string;
}) {
  const caption = sampleCaptionFromBrandKit(kit);
  const title = sampleTitleFromBrandKit(kit);
  const layout = previewLayoutFromBrandKit(kit);
  const channels = publishPlatformsSummary(kit);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Live-Vorschau</p>
          <p className="text-xs text-muted-foreground">
            Beispiel — ändert sich mit euren Einstellungen
          </p>
        </div>
        {badge ? (
          <span className="shrink-0 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-foreground">
            {badge}
          </span>
        ) : null}
      </div>

      <SocialTemplatePreview
        feedLayout={layout}
        feedPalette={kit.feedPalette}
        photoLook={kit.photoLook}
        restaurantName={restaurantName}
        title={title}
        caption={caption}
        ctaLabel={kit.cta}
        className="mx-auto w-full max-w-sm"
      />

      <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 space-y-1.5">
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
          {caption}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {SOCIAL_PHOTO_LOOK_LABELS[kit.photoLook]}
          {" · "}
          {channels}
        </p>
      </div>
    </div>
  );
}
