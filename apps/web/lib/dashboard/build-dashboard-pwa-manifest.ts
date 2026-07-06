import type { PlatformAppBranding } from "@/lib/types/platform-app-settings";
import {
  DASHBOARD_PWA_ICON_SIZES,
  DASHBOARD_PWA_MANIFEST_ID,
  DASHBOARD_PWA_SCOPE,
  DASHBOARD_PWA_START_URL,
  dashboardPwaIconPath,
} from "@/lib/dashboard/dashboard-pwa-config";

export type DashboardWebAppManifest = {
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

export function buildDashboardPwaManifest(
  branding: PlatformAppBranding,
): DashboardWebAppManifest {
  const appName = branding.appName.trim() || "gwada";
  const dashboardAppName = `${appName} - Dashboard`;
  const icons = DASHBOARD_PWA_ICON_SIZES.flatMap((size) => {
    const src = dashboardPwaIconPath(size);
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
    id: DASHBOARD_PWA_MANIFEST_ID,
    name: dashboardAppName,
    short_name: dashboardAppName,
    description:
      "Restaurant-Dashboard für Speisekarte, Reservierungen, Mitarbeiter und Betrieb.",
    start_url: DASHBOARD_PWA_START_URL,
    scope: DASHBOARD_PWA_SCOPE,
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    icons,
  };
}
