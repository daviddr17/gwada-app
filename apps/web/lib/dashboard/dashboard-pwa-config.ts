/** PWA für die App-Zone unter /dashboard (Restaurant-Betrieb). */

export const DASHBOARD_PWA_SCOPE = "/dashboard/";
export const DASHBOARD_PWA_START_URL = "/dashboard";
export const DASHBOARD_PWA_MANIFEST_PATH = "/dashboard/manifest.webmanifest";
export const DASHBOARD_PWA_SW_PATH = "/dashboard/sw.js";
export const DASHBOARD_PWA_MANIFEST_ID = `${DASHBOARD_PWA_START_URL}/`;

export const DASHBOARD_PWA_ICON_SIZES = [180, 192, 512] as const;

export type DashboardPwaIconSize = (typeof DASHBOARD_PWA_ICON_SIZES)[number];

export function isDashboardPwaIconSize(value: number): value is DashboardPwaIconSize {
  return (DASHBOARD_PWA_ICON_SIZES as readonly number[]).includes(value);
}

export function dashboardPwaIconPath(size: DashboardPwaIconSize): string {
  return `/dashboard/icon/${size}`;
}

export const DASHBOARD_PWA_SPLASH_PATH_PREFIX = "/dashboard/splash";

export function dashboardPwaSplashPath(width: number, height: number): string {
  return `${DASHBOARD_PWA_SPLASH_PATH_PREFIX}/${width}x${height}`;
}
