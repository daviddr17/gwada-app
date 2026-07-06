/** Standalone / Home-Bildschirm (PWA) — nur Client. */
export function isStandalonePwaClient(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export const DASHBOARD_PWA_SPLASH_DONE_ATTR = "data-dashboard-pwa-splash";

export function markDashboardPwaSplashDone(): void {
  document.documentElement.setAttribute(DASHBOARD_PWA_SPLASH_DONE_ATTR, "done");
}

export function clearDashboardPwaSplashDone(): void {
  document.documentElement.removeAttribute(DASHBOARD_PWA_SPLASH_DONE_ATTR);
}
