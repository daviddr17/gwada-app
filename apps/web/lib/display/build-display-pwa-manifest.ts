import type { PlatformAppBranding } from "@/lib/types/platform-app-settings";
import {
  DISPLAY_PWA_ICON_SIZES,
  DISPLAY_PWA_SCOPE,
  displayPwaIconPath,
  displayPwaManifestId,
  displayPwaStartUrl,
} from "@/lib/display/display-pwa-config";
import { PWA_APP_LABEL_DISPLAY } from "@/lib/pwa/pwa-app-labels";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";

export type DisplayWebAppManifest = {
  id: string;
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: "standalone";
  orientation: "any";
  background_color: string;
  theme_color: string;
  icons: Array<{
    src: string;
    sizes: string;
    type: "image/png";
    purpose: "any" | "maskable";
  }>;
};

export type BuildDisplayPwaManifestOptions = {
  slug?: string | null;
};

export function buildDisplayPwaManifest(
  _branding: PlatformAppBranding,
  options?: BuildDisplayPwaManifestOptions,
): DisplayWebAppManifest {
  const startUrl = displayPwaStartUrl(options?.slug);
  const displayAppName = PWA_APP_LABEL_DISPLAY;
  const icons = DISPLAY_PWA_ICON_SIZES.flatMap((size) => {
    const src = displayPwaIconPath(size);
    const entry = {
      src,
      sizes: `${size}x${size}`,
      type: "image/png" as const,
    };
    if (size === 512) {
      return [
        { ...entry, purpose: "any" as const },
        { ...entry, purpose: "maskable" as const },
      ];
    }
    return [{ ...entry, purpose: "any" as const }];
  });

  return {
    id: displayPwaManifestId(options?.slug),
    name: displayAppName,
    short_name: displayAppName,
    description:
      "Restaurant-Display für Schicht, Reservierungen, Bestand und Checklisten.",
    start_url: startUrl,
    scope: DISPLAY_PWA_SCOPE,
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: DEFAULT_ACCENT_HEX,
    icons,
  };
}
