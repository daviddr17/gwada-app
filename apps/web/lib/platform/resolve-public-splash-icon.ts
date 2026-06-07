import {
  isFaviconRenderableInImg,
  withBrandingAssetCacheBust,
} from "@/lib/platform/branding-asset-url";
import { resolvePlatformLogoSrc } from "@/lib/platform/resolve-platform-logo";
import type { PlatformAppBranding } from "@/lib/types/platform-app-settings";

/** Favicon für Splash (PNG/SVG/…), sonst Logo. */
export function resolvePublicSplashIconSrc(
  branding: PlatformAppBranding,
): string | null {
  const faviconSrc = withBrandingAssetCacheBust(
    branding.faviconUrl,
    branding.faviconPath,
  );
  if (faviconSrc && isFaviconRenderableInImg(branding.faviconPath)) {
    return faviconSrc;
  }
  return resolvePlatformLogoSrc(branding, "light");
}
