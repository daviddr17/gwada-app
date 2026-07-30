"use client";

import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { GwadaFaviconIcon } from "@/components/icons/gwada-favicon-icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  REVIEW_PLATFORM_LABELS,
  type ReviewPlatform,
} from "@/lib/constants/review-platforms";
import type { ReviewRequestIncludes } from "@/lib/reviews/review-request-settings";
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

type PlatformToggle = {
  platform: ReviewPlatform;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
};

function ReviewPlatformToggleChip({
  platform,
  checked,
  onCheckedChange,
  disabled,
}: PlatformToggle) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        checked
          ? "border-accent/50 bg-accent/15 text-foreground"
          : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
        disabled && "pointer-events-none opacity-50",
      )}
      aria-pressed={checked}
    >
      <PlatformIcon platform={platform} />
      {REVIEW_PLATFORM_LABELS[platform]}
    </button>
  );
}

export function ReviewRequestPlatformsField({
  includes,
  onIncludesChange,
  googleUrl,
  facebookUrl,
  onGoogleUrlChange,
  onFacebookUrlChange,
  showUrlFields,
  thanksEnabled,
  disabled,
  loading,
  googleConnected,
  facebookConnected,
  connectionsLoading,
}: {
  includes: ReviewRequestIncludes;
  onIncludesChange: (patch: Partial<ReviewRequestIncludes>) => void;
  googleUrl: string;
  facebookUrl: string;
  onGoogleUrlChange: (v: string) => void;
  onFacebookUrlChange: (v: string) => void;
  /** Optionale URLs nur einmal anzeigen (gilt für beide Kanäle). */
  showUrlFields?: boolean;
  thanksEnabled: boolean;
  disabled?: boolean;
  loading?: boolean;
  googleConnected: boolean;
  facebookConnected: boolean;
  connectionsLoading?: boolean;
}) {
  const blockDisabled = disabled || loading || !thanksEnabled;
  const googleUnavailable = connectionsLoading || !googleConnected;
  const facebookUnavailable = connectionsLoading || !facebookConnected;

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border border-dashed border-border/50 bg-muted/15 p-3",
        blockDisabled && "opacity-60",
      )}
    >
      <div className="space-y-1">
        <p className="text-sm font-medium">Bewertungslinks anhängen</p>
        <p className="text-xs text-muted-foreground">
          Wird unter den Nachrichtentext gesetzt. Gwada nutzt den
          Einladungslink nach dem Besuch.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <ReviewPlatformToggleChip
          platform="gwada"
          checked={includes.includeGwada}
          disabled={blockDisabled}
          onCheckedChange={(v) => onIncludesChange({ includeGwada: v })}
        />
        <ReviewPlatformToggleChip
          platform="google"
          checked={includes.includeGoogle}
          disabled={blockDisabled || googleUnavailable}
          onCheckedChange={(v) => onIncludesChange({ includeGoogle: v })}
        />
        <ReviewPlatformToggleChip
          platform="facebook"
          checked={includes.includeFacebook}
          disabled={blockDisabled || facebookUnavailable}
          onCheckedChange={(v) => onIncludesChange({ includeFacebook: v })}
        />
      </div>

      {!connectionsLoading && includes.includeGoogle && !googleConnected ? (
        <p className="text-xs text-muted-foreground">
          Google Business unter Einstellungen → Integrationen verbinden, damit
          der Link automatisch ergänzt werden kann (oder URL unten eintragen).
        </p>
      ) : null}

      {!connectionsLoading &&
      includes.includeGoogle &&
      googleConnected &&
      !googleUrl.trim() ? (
        <p className="text-xs text-muted-foreground">
          Ohne URL wird der Google-Link beim Versand aus dem verbundenen
          Standort geladen. Optional unten fest eintragen.
        </p>
      ) : null}

      {!connectionsLoading && includes.includeFacebook && !facebookConnected ? (
        <p className="text-xs text-muted-foreground">
          Facebook unter Einstellungen → Integrationen verbinden, damit der
          Link automatisch ergänzt werden kann (oder URL unten eintragen).
        </p>
      ) : null}

      {showUrlFields && includes.includeGoogle ? (
        <div className="space-y-1.5">
          <Label
            htmlFor="review-google-url"
            className="text-xs text-muted-foreground"
          >
            Google-Bewertungs-URL (optional)
          </Label>
          <Input
            id="review-google-url"
            value={googleUrl}
            disabled={blockDisabled}
            onChange={(e) => onGoogleUrlChange(e.target.value)}
            placeholder="https://g.page/…/review"
            className="h-10 rounded-xl text-sm"
          />
        </div>
      ) : null}

      {showUrlFields && includes.includeFacebook ? (
        <div className="space-y-1.5">
          <Label
            htmlFor="review-facebook-url"
            className="text-xs text-muted-foreground"
          >
            Facebook-URL (optional)
          </Label>
          <Input
            id="review-facebook-url"
            value={facebookUrl}
            disabled={blockDisabled}
            onChange={(e) => onFacebookUrlChange(e.target.value)}
            placeholder="https://www.facebook.com/…/reviews"
            className="h-10 rounded-xl text-sm"
          />
        </div>
      ) : null}
    </div>
  );
}
