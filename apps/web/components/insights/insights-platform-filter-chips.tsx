"use client";

import { FacebookGlyph } from "@/components/icons/facebook-glyph";
import { GoogleGlyph } from "@/components/icons/google-glyph";
import { GwadaFaviconIcon } from "@/components/icons/gwada-favicon-icon";
import { InstagramGlyph } from "@/components/icons/instagram-glyph";
import { TripadvisorGlyph } from "@/components/icons/tripadvisor-glyph";
import { LexofficeGlyph } from "@/components/icons/lexoffice-glyph";
import {
  INSIGHTS_PLATFORM_LABELS,
  INSIGHTS_PLATFORM_ORDER,
  type InsightsPlatform,
} from "@/lib/constants/insights-platforms";
import { cn } from "@/lib/utils";

function InsightsPlatformIcon({
  platform,
  className,
}: {
  platform: InsightsPlatform;
  className?: string;
}) {
  const iconClass = cn("size-4 shrink-0", className);
  if (platform === "google_business") return <GoogleGlyph className={iconClass} />;
  if (platform === "facebook") return <FacebookGlyph className={iconClass} />;
  if (platform === "instagram") return <InstagramGlyph className={iconClass} />;
  if (platform === "tripadvisor") {
    return <TripadvisorGlyph className={iconClass} />;
  }
  if (platform === "lexoffice") {
    return <LexofficeGlyph className={iconClass} />;
  }
  return <GwadaFaviconIcon size="chip" className={className} />;
}

export function InsightsPlatformFilterChips({
  value,
  onChange,
  availablePlatforms,
  disabled,
}: {
  value: InsightsPlatform;
  onChange: (next: InsightsPlatform) => void;
  availablePlatforms: Set<InsightsPlatform>;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex flex-wrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label="Plattform"
    >
      {INSIGHTS_PLATFORM_ORDER.filter((platform) =>
        availablePlatforms.has(platform),
      ).map((platform) => (
        <button
          key={platform}
          type="button"
          disabled={disabled}
          onClick={() => onChange(platform)}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
            value === platform
              ? "border-accent/50 bg-accent/15 text-foreground"
              : "border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground",
            disabled && "pointer-events-none opacity-50",
          )}
          aria-pressed={value === platform}
        >
          <InsightsPlatformIcon platform={platform} />
          <span>{INSIGHTS_PLATFORM_LABELS[platform]}</span>
        </button>
      ))}
    </div>
  );
}
