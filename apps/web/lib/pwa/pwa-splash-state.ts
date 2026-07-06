export type PwaSplashAppId = "dashboard" | "display";

const DONE_ATTR_BY_APP: Record<PwaSplashAppId, string> = {
  dashboard: "data-dashboard-pwa-splash",
  display: "data-display-pwa-splash",
};

export function pwaSplashDoneAttr(app: PwaSplashAppId): string {
  return DONE_ATTR_BY_APP[app];
}

export function markPwaSplashDone(app: PwaSplashAppId): void {
  document.documentElement.setAttribute(DONE_ATTR_BY_APP[app], "done");
}

export function clearPwaSplashDone(app: PwaSplashAppId): void {
  document.documentElement.removeAttribute(DONE_ATTR_BY_APP[app]);
}
