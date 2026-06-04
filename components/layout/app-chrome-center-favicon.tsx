"use client";

import { useEffect, useState } from "react";
import { usePlatformAppBrandingOptional } from "@/lib/contexts/platform-app-branding-context";
import { useResolvedPlatformLogoSrc } from "@/lib/hooks/use-resolved-platform-logo-src";
import {
  isFaviconRenderableInImg,
  platformFaviconHref,
  withBrandingAssetCacheBust,
} from "@/lib/platform/branding-asset-url";
import { cn } from "@/lib/utils";

const ICON_CLASS = "size-7 shrink-0 object-contain object-center md:size-8";

/**
 * Favicon / App-Icon in der Top-Chrome-Zeile (mittig im Header-Inset, nicht am Titel).
 */
export function AppChromeCenterFavicon({ className }: { className?: string }) {
  const branding = usePlatformAppBrandingOptional();
  const logoSrc = useResolvedPlatformLogoSrc();
  const faviconPath = branding?.faviconPath ?? null;
  const faviconApiSrc = platformFaviconHref(faviconPath);
  const faviconDirectSrc = withBrandingAssetCacheBust(
    branding?.faviconUrl ?? null,
    faviconPath,
  );
  const faviconOkForImg =
    Boolean(faviconApiSrc) || isFaviconRenderableInImg(faviconPath);
  const faviconImgSrc = faviconApiSrc ?? faviconDirectSrc;

  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [faviconImgSrc, faviconOkForImg]);

  if (!branding?.isReady) {
    return null;
  }

  const preferFavicon = Boolean(faviconImgSrc && faviconOkForImg && !imgFailed);
  const src = preferFavicon ? faviconImgSrc : logoSrc;

  if (!src) {
    return null;
  }

  const appName = branding.appName ?? "App";

  return (
    <div
      className={cn(
        "flex h-full max-h-[var(--app-chrome-header-h)] shrink-0 items-center justify-center px-0.5",
        className,
      )}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={src}
        src={src}
        alt=""
        decoding="async"
        className={ICON_CLASS}
        onError={() => {
          if (preferFavicon && logoSrc) {
            setImgFailed(true);
          }
        }}
      />
      <span className="sr-only">{appName}</span>
    </div>
  );
}
