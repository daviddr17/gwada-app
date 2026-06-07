"use client";

import { useEffect, useState } from "react";
import { usePlatformAppBrandingOptional } from "@/lib/contexts/platform-app-branding-context";
import { useResolvedPlatformLogoSrc } from "@/lib/hooks/use-resolved-platform-logo-src";
import {
  isFaviconRenderableInImg,
  platformFaviconHref,
  withBrandingAssetCacheBust,
} from "@/lib/platform/branding-asset-url";

/** Favicon für Chrome / Upload-Overlay — Fallback auf App-Logo. */
export function useAppFaviconDisplay(): {
  src: string | null;
  onImageError: () => void;
} {
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
    return { src: null, onImageError: () => {} };
  }

  const preferFavicon = Boolean(faviconImgSrc && faviconOkForImg && !imgFailed);
  const src = preferFavicon ? faviconImgSrc : logoSrc;

  return {
    src,
    onImageError: () => {
      if (preferFavicon && logoSrc) setImgFailed(true);
    },
  };
}
