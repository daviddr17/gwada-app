import type { PlatformAppBranding } from "@/lib/types/platform-app-settings";
import type { PlatformLogoTheme } from "@/lib/platform/resolve-platform-logo";

const LOGO_PATH_PREFIXES = ["logo-", "logo_dark-"] as const;

export function isAllowedPlatformLogoStoragePath(
  storagePath: string | null | undefined,
): boolean {
  const path = storagePath?.trim();
  if (!path || path.includes("..") || path.includes("/")) return false;
  return LOGO_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function platformLogoStoragePathForTheme(
  branding:
    | Pick<PlatformAppBranding, "logoPath" | "logoDarkPath">
    | null
    | undefined,
  theme: PlatformLogoTheme,
): string | null {
  if (!branding) return null;
  if (theme === "dark") {
    const dark = branding.logoDarkPath?.trim();
    if (dark) return dark;
  }
  return branding.logoPath?.trim() || null;
}

/** Optimiertes Hero-Logo — WebP ~240px, gleiche Origin, versioniert über Storage-Pfad. */
export function platformMarketingLogoHref(
  branding:
    | Pick<PlatformAppBranding, "logoPath" | "logoDarkPath">
    | null
    | undefined,
  theme: PlatformLogoTheme = "light",
): string | null {
  const path = platformLogoStoragePathForTheme(branding, theme);
  if (!path || !isAllowedPlatformLogoStoragePath(path)) return null;
  const params = new URLSearchParams({ v: path, theme });
  return `/api/platform/logo?${params.toString()}`;
}
