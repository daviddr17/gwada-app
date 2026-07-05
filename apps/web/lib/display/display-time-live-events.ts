export const GWADA_DISPLAY_TIME_REFRESH_EVENT = "gwada:display-time-refresh";

export function dispatchDisplayTimeRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GWADA_DISPLAY_TIME_REFRESH_EVENT));
}
