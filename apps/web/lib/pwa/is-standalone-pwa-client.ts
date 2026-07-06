/** Standalone / Home-Bildschirm (PWA) — nur Client. */
export function isStandalonePwaClient(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export {
  clearPwaSplashDone as clearDashboardPwaSplashDone,
  markPwaSplashDone as markDashboardPwaSplashDone,
  pwaSplashDoneAttr,
} from "@/lib/pwa/pwa-splash-state";

export const DASHBOARD_PWA_SPLASH_DONE_ATTR = "data-dashboard-pwa-splash";
export const DISPLAY_PWA_SPLASH_DONE_ATTR = "data-display-pwa-splash";

export function markDisplayPwaSplashDone(): void {
  document.documentElement.setAttribute(DISPLAY_PWA_SPLASH_DONE_ATTR, "done");
}

export function clearDisplayPwaSplashDone(): void {
  document.documentElement.removeAttribute(DISPLAY_PWA_SPLASH_DONE_ATTR);
}
