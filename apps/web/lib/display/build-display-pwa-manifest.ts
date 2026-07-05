import type { PlatformAppBranding } from "@/lib/types/platform-app-settings";
import {
  DISPLAY_PWA_ICON_SIZES,
  DISPLAY_PWA_SCOPE,
  DISPLAY_PWA_START_URL,
  displayPwaIconPath,
} from "@/lib/display/display-pwa-config";

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

export function buildDisplayPwaManifest(
  branding: PlatformAppBranding,
): DisplayWebAppManifest {
  const appName = branding.appName.trim() || "gwada";
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
    id: DISPLAY_PWA_SCOPE,
    name: `${appName} Display`,
    short_name: "Display",
    description:
      "Restaurant-Display für Schicht, Reservierungen, Bestand und Checklisten.",
    start_url: DISPLAY_PWA_START_URL,
    scope: DISPLAY_PWA_SCOPE,
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    icons,
  };
}
