"use client";

import { memo, type CSSProperties } from "react";
import type {
  SocialFeedLayoutId,
  SocialFeedPalette,
  SocialPhotoLook,
} from "@/lib/social/social-feed-brand-system";
import { DEFAULT_SOCIAL_FEED_PALETTE } from "@/lib/social/social-feed-brand-system";
import { overlayLineFromCaption } from "@/lib/social/social-caption-templates";
import {
  layoutHeadline,
  layoutSupportingLine,
} from "@/lib/social/social-template-layout-text";
import { cn } from "@/lib/utils";

function photoLookFilter(look: SocialPhotoLook): string | undefined {
  if (look === "warm") return "sepia(0.16) saturate(1.14) contrast(1.05)";
  if (look === "cool") return "saturate(0.9) hue-rotate(-8deg) brightness(1.03)";
  return "saturate(1.02) contrast(1.02)";
}

function LogoMark({
  logoUrl,
  className,
}: {
  logoUrl?: string | null;
  className?: string;
}) {
  if (!logoUrl) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt=""
      className={cn(
        "size-11 rounded-full border-[3px] border-white object-cover shadow-md",
        className,
      )}
    />
  );
}

export const SocialTemplatePreview = memo(function SocialTemplatePreview({
  feedLayout,
  feedPalette,
  photoLook = "warm",
  restaurantName,
  title,
  caption,
  ctaLabel,
  imageUrl,
  logoUrl,
  overlayLine,
  className,
}: {
  feedLayout: SocialFeedLayoutId;
  feedPalette?: SocialFeedPalette | null;
  photoLook?: SocialPhotoLook;
  restaurantName: string;
  title?: string | null;
  caption: string;
  ctaLabel?: string | null;
  imageUrl?: string | null;
  logoUrl?: string | null;
  overlayLine?: string | null;
  className?: string;
}) {
  const palette = feedPalette ?? DEFAULT_SOCIAL_FEED_PALETTE;
  const accent = palette.accent;
  const secondary = palette.secondary ?? accent;
  const dark = palette.surfaceDark;
  const light = palette.surfaceLight;
  const line =
    overlayLine?.trim() ||
    overlayLineFromCaption(caption, { cta: ctaLabel ?? "" });
  const headline = layoutHeadline(title, line, restaurantName);
  const support = layoutSupportingLine(line, headline);
  const cta = (ctaLabel?.trim() || "Tisch reservieren") + " →";
  const filter = photoLookFilter(photoLook);

  const shell = cn(
    "relative aspect-square overflow-hidden rounded-xl border border-border/50 shadow-card",
    className,
  );

  if (feedLayout === "editorial_hero") {
    return (
      <div className={cn(shell, "bg-neutral-900")}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 size-full object-cover"
            style={filter ? { filter } : undefined}
          />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: dark }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        <LogoMark logoUrl={logoUrl} className="absolute top-4 right-4 z-10" />
        <div className="absolute inset-x-0 bottom-0 px-5 pb-5 pt-20 text-white">
          <p className="text-[10px] font-semibold tracking-[0.28em] text-white/70 uppercase">
            {restaurantName}
          </p>
          <div className="mt-2 flex items-center gap-1.5" aria-hidden>
            <div className="h-0.5 w-9" style={{ backgroundColor: accent }} />
            <div
              className="h-0.5 w-3"
              style={{ backgroundColor: secondary, opacity: 0.7 }}
            />
          </div>
          <p className="mt-3 font-serif text-[1.65rem] leading-[1.1] tracking-tight">
            {headline}
          </p>
          {support ? (
            <p className="mt-2 line-clamp-2 text-sm text-white/85">{support}</p>
          ) : null}
          <p className="mt-3 text-xs font-semibold tracking-wide" style={{ color: accent }}>
            {cta}
          </p>
        </div>
      </div>
    );
  }

  if (feedLayout === "atelier_split") {
    return (
      <div className={shell} style={{ backgroundColor: dark }}>
        <div className="absolute inset-x-0 top-0 px-3.5 pt-3.5" style={{ height: "56%" }}>
          <div className="relative h-full overflow-hidden rounded-sm">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className="size-full object-cover"
                style={filter ? { filter } : undefined}
              />
            ) : (
              <div className="size-full" style={{ backgroundColor: dark }} />
            )}
            <LogoMark logoUrl={logoUrl} className="absolute top-3 right-3" />
          </div>
        </div>
        <div
          className="absolute inset-x-0 bottom-0 flex flex-col justify-between px-5 pb-5 pt-4"
          style={{ top: "56%", color: light }}
        >
          <div
            className="mb-3 h-0.5 w-12"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
          <div className="space-y-2">
            <p className="text-[10px] font-semibold tracking-[0.28em] uppercase opacity-55">
              {restaurantName}
            </p>
            <p className="font-serif text-2xl leading-tight tracking-tight">
              {headline}
            </p>
            {support ? (
              <p className="line-clamp-2 text-sm opacity-75">{support}</p>
            ) : null}
          </div>
          <p
            className="mt-3 text-xs font-semibold tracking-wide"
            style={{ color: accent }}
          >
            {cta}
          </p>
        </div>
      </div>
    );
  }

  if (feedLayout === "soiree_event") {
    return (
      <div className={cn(shell, "bg-black")}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-50"
            style={filter ? { filter } : undefined}
          />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: dark }} />
        )}
        <div className="absolute inset-0 bg-black/40" />
        <div
          className="absolute inset-4 flex flex-col items-center justify-center px-4 text-center"
          style={
            {
              color: light,
              boxShadow: `inset 0 0 0 1.5px ${accent}cc, inset 0 0 0 7px ${secondary}33`,
            } as CSSProperties
          }
        >
          <LogoMark logoUrl={logoUrl} className="mb-4 border-white/40" />
          <p className="text-[10px] font-semibold tracking-[0.3em] uppercase opacity-70">
            {restaurantName}
          </p>
          <p className="mt-5 font-serif text-3xl leading-none tracking-tight">
            {headline}
          </p>
          {support ? (
            <p className="mt-4 line-clamp-3 text-sm opacity-85">{support}</p>
          ) : null}
          <div
            className="mt-5 h-px w-14"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
          <p className="mt-3 text-xs font-semibold" style={{ color: accent }}>
            {cta}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        shell,
        "flex flex-col items-center justify-center px-8 text-center",
      )}
      style={{ backgroundColor: light, color: dark }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 size-full object-cover opacity-[0.12]"
          style={filter ? { filter } : undefined}
        />
      ) : null}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: light, opacity: imageUrl ? 0.94 : 1 }}
        aria-hidden
      />
      <div className="relative z-10 flex flex-col items-center">
        {logoUrl ? (
          <LogoMark logoUrl={logoUrl} className="mb-5 size-14 border-border/30" />
        ) : (
          <div
            className="mb-5 size-14 rounded-full border"
            style={{
              borderColor: `${accent}88`,
              backgroundColor: `${secondary}33`,
            }}
            aria-hidden
          />
        )}
        <p className="font-serif text-3xl leading-tight tracking-tight">
          {restaurantName}
        </p>
        <div
          className="my-4 h-0.5 w-12"
          style={{ backgroundColor: accent }}
          aria-hidden
        />
        <p className="font-serif text-lg italic leading-snug opacity-90">
          {support || headline}
        </p>
        <p
          className="mt-6 text-xs font-semibold tracking-wide"
          style={{ color: accent }}
        >
          {cta}
        </p>
      </div>
    </div>
  );
});
