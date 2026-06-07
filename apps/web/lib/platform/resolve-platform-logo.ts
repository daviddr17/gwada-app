import { withBrandingAssetCacheBust } from "@/lib/platform/branding-asset-url";
import type { PlatformAppBranding } from "@/lib/types/platform-app-settings";

export type PlatformLogoTheme = "light" | "dark";

export function resolvePlatformLogoSrc(
  branding:
    | Pick<
        PlatformAppBranding,
        "logoUrl" | "logoPath" | "logoDarkUrl" | "logoDarkPath"
      >
    | null
    | undefined,
  theme: PlatformLogoTheme,
): string | null {
  if (!branding) return null;

  if (theme === "dark") {
    const dark = withBrandingAssetCacheBust(
      branding.logoDarkUrl,
      branding.logoDarkPath,
    );
    if (dark) return dark;
  }

  return withBrandingAssetCacheBust(branding.logoUrl, branding.logoPath);
}
