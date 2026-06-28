import type { NotificationModuleId } from "@/lib/notifications/notification-modules";

/** Glocken-Menü und Badge nach mark-read oder Modul-Updates aktualisieren. */
export const GWADA_NOTIFICATIONS_REFRESH_EVENT = "gwada:notifications-refresh";

/** Sofort-Patch der Glocke bei inbound contact_messages (ohne API-Roundtrip). */
export const GWADA_NOTIFICATIONS_MESSAGE_LIVE_EVENT =
  "gwada:notifications-message-live";

/** Modul sofort aus Glochen-Cache entfernen (Seitenbesuch / alle gelesen). */
export const GWADA_NOTIFICATIONS_MODULE_CLEARED_EVENT =
  "gwada:notifications-module-cleared";

export function dispatchNotificationsRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GWADA_NOTIFICATIONS_REFRESH_EVENT));
}

export function dispatchNotificationModuleCleared(
  restaurantId: string,
  moduleId: NotificationModuleId,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(GWADA_NOTIFICATIONS_MODULE_CLEARED_EVENT, {
      detail: { restaurantId, moduleId },
    }),
  );
}
