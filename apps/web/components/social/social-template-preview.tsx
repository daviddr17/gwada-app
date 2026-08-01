"use client";

import type { CSSProperties } from "react";
import type {
  SocialFeedLayoutId,
  SocialFeedPalette,
  SocialPhotoLook,
} from "@/lib/social/social-feed-brand-system";
import { DEFAULT_SOCIAL_FEED_PALETTE } from "@/lib/social/social-feed-brand-system";
import { overlayLineFromCaption } from "@/lib/social/social-caption-templates";
import { cn } from "@/lib/utils";

function photoLookFilter(look: SocialPhotoLook): string | undefined {
  if (look === "warm") return "sepia(0.18) saturate(1.12) contrast(1.04)";
  if (look === "cool") return "saturate(0.92) hue-rotate(12deg) brightness(1.03)";
  return undefined;
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
        "size-9 rounded-full border border-white/35 object-cover shadow-sm",
        className,
      )}
    />
  );
}

export function SocialTemplatePreview({
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
  const headline = title?.trim() || "Diese Woche";
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
        <LogoMark logoUrl={logoUrl} className="absolute top-4 right-4 z-10" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent px-5 pb-5 pt-16 text-white">
          <p className="text-[10px] font-medium tracking-[0.2em] text-white/75 uppercase">
            {restaurantName}
          </p>
          <div className="mt-2 flex items-center gap-1.5" aria-hidden>
            <div className="h-px w-8" style={{ backgroundColor: accent }} />
            <div
              className="h-px w-3"
              style={{ backgroundColor: secondary, opacity: 0.7 }}
            />
          </div>
          <p className="mt-2 font-serif text-2xl leading-tight tracking-tight">
            {headline}
          </p>
          {line ? (
            <p className="mt-1 line-clamp-2 text-sm text-white/85">{line}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (feedLayout === "atelier_split") {
    return (
      <div className={shell} style={{ backgroundColor: dark }}>
        <div className="absolute inset-x-0 top-0 h-[58%] overflow-hidden">
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
          <LogoMark logoUrl={logoUrl} className="absolute top-4 right-4" />
        </div>
        <div
          className="absolute inset-x-0 bottom-0 flex h-[42%] flex-col justify-between px-5 py-4"
          style={{ backgroundColor: dark, color: light }}
        >
          <div
            className="absolute inset-x-0 top-0 h-0.5"
            style={{ backgroundColor: secondary, opacity: 0.55 }}
            aria-hidden
          />
          <div className="space-y-2">
            <p className="text-[10px] font-medium tracking-[0.18em] uppercase opacity-70">
              {restaurantName}
            </p>
            <p className="font-serif text-xl leading-tight">{headline}</p>
            {line ? (
              <p className="line-clamp-2 text-sm opacity-80">{line}</p>
            ) : null}
          </div>
          <div>
            <div
              className="mb-2 h-px w-10"
              style={{ backgroundColor: accent }}
              aria-hidden
            />
            <p
              className="text-[11px] font-medium tracking-wide"
              style={{ color: accent }}
            >
              {cta}
            </p>
          </div>
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
            className="absolute inset-0 size-full object-cover opacity-55"
            style={filter ? { filter } : undefined}
          />
        ) : (
          <div className="absolute inset-0" style={{ backgroundColor: dark }} />
        )}
        <div
          className="absolute inset-4 flex flex-col items-center justify-center px-4 text-center"
          style={
            {
              color: light,
              boxShadow: `inset 0 0 0 1px ${accent}99, inset 0 0 0 6px ${secondary}33`,
            } as CSSProperties
          }
        >
          <LogoMark logoUrl={logoUrl} className="mb-3 border-white/25" />
          <p className="text-[10px] font-medium tracking-[0.22em] uppercase opacity-75">
            {restaurantName}
          </p>
          <p className="mt-4 font-serif text-3xl leading-none tracking-tight">
            {headline}
          </p>
          {line ? (
            <p className="mt-3 line-clamp-3 text-sm opacity-85">{line}</p>
          ) : null}
          <div
            className="mt-5 h-px w-12"
            style={{ backgroundColor: accent }}
            aria-hidden
          />
        </div>
      </div>
    );
  }

  // signature_brand — optional soft photo wash for Markenkohärenz
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
          className="absolute inset-0 size-full object-cover opacity-[0.14]"
          style={filter ? { filter } : undefined}
        />
      ) : null}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: light, opacity: imageUrl ? 0.92 : 1 }}
        aria-hidden
      />
      <div className="relative z-10 flex flex-col items-center">
        {logoUrl ? (
          <LogoMark logoUrl={logoUrl} className="mb-4 size-12 border-border/40" />
        ) : (
          <div
            className="mb-4 size-12 rounded-full border"
            style={{
              borderColor: `${accent}88`,
              backgroundColor: `${secondary}33`,
            }}
            aria-hidden
          />
        )}
        <p className="font-serif text-2xl leading-tight tracking-tight">
          {restaurantName}
        </p>
        <div
          className="my-4 h-px w-10"
          style={{ backgroundColor: accent }}
          aria-hidden
        />
        <p className="font-serif text-lg italic leading-snug opacity-90">
          {line || headline}
        </p>
        {title?.trim() && line ? (
          <p className="mt-3 text-[11px] tracking-[0.14em] uppercase opacity-55">
            {headline}
          </p>
        ) : null}
      </div>
    </div>
  );
}
