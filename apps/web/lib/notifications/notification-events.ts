/** Glocken-Menü und Badge nach mark-read oder Modul-Updates aktualisieren. */
export const GWADA_NOTIFICATIONS_REFRESH_EVENT = "gwada:notifications-refresh";

/** Sofort-Patch der Glocke bei inbound contact_messages (ohne API-Roundtrip). */
export const GWADA_NOTIFICATIONS_MESSAGE_LIVE_EVENT =
  "gwada:notifications-message-live";

export function dispatchNotificationsRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GWADA_NOTIFICATIONS_REFRESH_EVENT));
}
