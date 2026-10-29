"use client";

import { SocialTemplatePreview } from "@/components/social/social-template-preview";
import type { SocialBrandKit } from "@/lib/social/social-brand-kit";
import {
  previewLayoutFromBrandKit,
  previewPaletteFromBrandKit,
  publishPlatformsSummary,
  sampleCaptionFromBrandKit,
  sampleTitleFromBrandKit,
  type SocialAutopilotPreviewIdentityClient,
} from "@/lib/social/social-autopilot-sample-preview";
import {
  SOCIAL_PHOTO_LOOK_LABELS,
  SOCIAL_TONE_LABELS,
} from "@/lib/social/social-brand-kit";
import { SOCIAL_FEED_LAYOUT_LABELS } from "@/lib/social/social-feed-brand-system";
import { cn } from "@/lib/utils";

/**
 * Eine kohärente Live-Vorschau für Autopilot-Einstellungen:
 * Template mit Restaurant-Profil (Name, Logo, Cover) + Brand-Farben;
 * Ton/Stimme/CTA/Kanäle/Look ändern Caption & Chrome sofort — kein LLM.
 */
export function SocialAutopilotLivePreview({
  kit,
  identity,
  badge,
  className,
}: {
  kit: SocialBrandKit;
  identity?: SocialAutopilotPreviewIdentityClient | null;
  /** z. B. „Vorschlag“ während Aus-Social-Entwurf */
  badge?: string | null;
  className?: string;
}) {
  const restaurantName = identity?.name?.trim() || "Euer Restaurant";
  const caption = sampleCaptionFromBrandKit(kit, restaurantName);
  const title = sampleTitleFromBrandKit(kit);
  const layout = previewLayoutFromBrandKit(kit);
  const palette = previewPaletteFromBrandKit(kit, identity?.accentHex);
  const channels = publishPlatformsSummary(kit);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium text-foreground">Live-Vorschau</p>
          <p className="text-xs text-muted-foreground">
            Euer Profil + Stil — ändert sich sofort mit den Einstellungen
          </p>
        </div>
        {badge ? (
          <span className="shrink-0 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[11px] font-medium text-foreground">
            {badge}
          </span>
        ) : null}
      </div>

      <div className="mx-auto w-full max-w-sm space-y-2">
        <SocialTemplatePreview
          feedLayout={layout}
          feedPalette={palette}
          photoLook={kit.photoLook}
          restaurantName={restaurantName}
          title={title}
          caption={caption}
          ctaLabel={kit.cta}
          imageUrl={identity?.coverUrl}
          logoUrl={identity?.logoUrl}
          className="w-full"
        />

        <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[10px] font-medium text-foreground">
              {SOCIAL_TONE_LABELS[kit.tone]}
            </span>
            <span className="rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {SOCIAL_FEED_LAYOUT_LABELS[layout]}
            </span>
            <span className="rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {SOCIAL_PHOTO_LOOK_LABELS[kit.photoLook]}
            </span>
            <span
              className="size-3.5 rounded-full border border-border/50"
              style={{ backgroundColor: palette.accent }}
              title="Akzentfarbe"
              aria-hidden
            />
          </div>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
            {caption}
          </p>
          <p className="text-[11px] text-muted-foreground">{channels}</p>
        </div>
      </div>
    </div>
  );
}
