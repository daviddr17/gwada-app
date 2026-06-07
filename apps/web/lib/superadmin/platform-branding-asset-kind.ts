import type { PlatformBrandingAssetKind } from "@/lib/types/platform-app-settings";

export const PLATFORM_BRANDING_ASSET_FIELDS: Record<
  PlatformBrandingAssetKind,
  { dbField: "logo_path" | "logo_dark_path" | "favicon_path"; storagePrefix: string }
> = {
  logo: { dbField: "logo_path", storagePrefix: "logo" },
  logo_dark: { dbField: "logo_dark_path", storagePrefix: "logo_dark" },
  favicon: { dbField: "favicon_path", storagePrefix: "favicon" },
};

export function isPlatformBrandingAssetKind(
  value: string,
): value is PlatformBrandingAssetKind {
  return value === "logo" || value === "logo_dark" || value === "favicon";
}
