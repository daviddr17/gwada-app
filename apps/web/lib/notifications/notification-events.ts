/** Glocken-Menü und Badge nach mark-read oder Modul-Updates aktualisieren. */
export const GWADA_NOTIFICATIONS_REFRESH_EVENT = "gwada:notifications-refresh";

export function dispatchNotificationsRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GWADA_NOTIFICATIONS_REFRESH_EVENT));
}
