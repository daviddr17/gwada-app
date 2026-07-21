"use client";

import type { SocialStylePreset, SocialTemplateId } from "@/lib/social/social-brand-kit";
import { cn } from "@/lib/utils";

const PRESET_SURFACE: Record<SocialStylePreset, string> = {
  modern_plain: "bg-neutral-100 text-neutral-900",
  warm_gastro: "bg-[#2a211c] text-[#f7f0e8]",
  dark_fine: "bg-neutral-950 text-neutral-100",
};

export function SocialTemplatePreview({
  templateId,
  stylePreset,
  accentHex,
  restaurantName,
  title,
  caption,
  imageUrl,
  className,
}: {
  templateId: SocialTemplateId;
  stylePreset: SocialStylePreset;
  accentHex: string;
  restaurantName: string;
  title?: string | null;
  caption: string;
  imageUrl?: string | null;
  className?: string;
}) {
  const surface = PRESET_SURFACE[stylePreset] ?? PRESET_SURFACE.warm_gastro;

  if (templateId === "brand_card") {
    return (
      <div
        className={cn(
          "relative aspect-square overflow-hidden rounded-xl border border-border/50 shadow-card",
          surface,
          className,
        )}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-35"
          />
        ) : null}
        <div className="relative flex h-full flex-col justify-between p-5">
          <div
            className="h-1 w-12 rounded-full"
            style={{ backgroundColor: accentHex }}
          />
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] opacity-80">
              {restaurantName}
            </p>
            <p className="text-2xl font-semibold leading-tight tracking-tight">
              {title?.trim() || "Diese Woche"}
            </p>
            <p className="line-clamp-3 text-sm opacity-90 whitespace-pre-line">
              {caption}
            </p>
          </div>
          <div
            className="self-start rounded-md px-2.5 py-1 text-xs font-medium text-white"
            style={{ backgroundColor: accentHex }}
          >
            Gwada
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative aspect-square overflow-hidden rounded-xl border border-border/50 bg-muted shadow-card",
        className,
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className={cn("absolute inset-0", surface)} />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-4 pt-16 text-white">
        <div
          className="mb-2 h-0.5 w-10 rounded-full"
          style={{ backgroundColor: accentHex }}
        />
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/80">
          {restaurantName}
        </p>
        {title ? (
          <p className="mt-1 text-lg font-semibold leading-tight">{title}</p>
        ) : null}
        <p className="mt-1 line-clamp-2 text-sm text-white/90 whitespace-pre-line">
          {caption}
        </p>
      </div>
    </div>
  );
}
