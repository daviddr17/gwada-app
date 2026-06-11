"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { usePlatformAppBrandingOptional } from "@/lib/contexts/platform-app-branding-context";
import { useResolvedPlatformLogoSrc } from "@/lib/hooks/use-resolved-platform-logo-src";
import {
  isFaviconRenderableInImg,
  withBrandingAssetCacheBust,
} from "@/lib/platform/branding-asset-url";
import { cn } from "@/lib/utils";

type GwadaFaviconIconProps = {
  className?: string;
  /** Standardgröße in Chips und Listen; `meta` unter Nachrichten-Bubbles. */
  size?: "chip" | "md" | "meta";
};

const SIZE_CLASS = {
  chip: "size-4",
  md: "size-7",
  meta: "size-2.5",
} as const;

/** Öffentlicher Fallback ohne PlatformAppBrandingProvider (Embed, Profil). */
const PLATFORM_FAVICON_FALLBACK_SRC = "/api/platform/favicon";

/**
 * Plattform-Favicon (PNG/SVG/WebP) mit Logo-Fallback — wie in der Top-Chrome.
 */
export function GwadaFaviconIcon({
  className,
  size = "chip",
}: GwadaFaviconIconProps) {
  const branding = usePlatformAppBrandingOptional();
  const logoSrc = useResolvedPlatformLogoSrc();
  const faviconSrc = withBrandingAssetCacheBust(
    branding?.faviconUrl ?? null,
    branding?.faviconPath ?? null,
  );
  const faviconOkForImg = isFaviconRenderableInImg(branding?.faviconPath);
  const [imgFailed, setImgFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [faviconSrc, faviconOkForImg]);

  const preferFavicon = Boolean(faviconSrc && faviconOkForImg && !imgFailed);
  const src = preferFavicon ? faviconSrc : logoSrc;

  if (!src) {
    if (fallbackFailed) {
      return (
        <MessageCircle
          className={cn(SIZE_CLASS[size], "text-accent", className)}
          aria-hidden
        />
      );
    }

    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={PLATFORM_FAVICON_FALLBACK_SRC}
        alt=""
        decoding="async"
        className={cn(
          SIZE_CLASS[size],
          "shrink-0 object-contain object-center",
          className,
        )}
        onError={() => setFallbackFailed(true)}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt=""
      decoding="async"
      className={cn(
        SIZE_CLASS[size],
        "shrink-0 object-contain object-center",
        className,
      )}
      onError={() => {
        if (preferFavicon && logoSrc) setImgFailed(true);
      }}
    />
  );
}
