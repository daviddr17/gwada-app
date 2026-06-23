/** Dashboard-Widgets nach Realtime-Hinweis leicht aktualisieren (kein Voll-Polling). */
export const GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT =
  "gwada:dashboard-messages-refresh";

export type DashboardMessagesRefreshDetail = {
  restaurantId: string;
  /** Einzelne Konversation als gelesen — optimistisches Dashboard-Patch. */
  contactId?: string;
  /** Alle Nachrichten gelesen — optimistisches Dashboard-Patch. */
  all?: boolean;
};

export function dispatchDashboardMessagesRefresh(
  detail?: DashboardMessagesRefreshDetail,
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT, { detail }),
  );
}

/** Nur WAHA-ACK/Reactions mergen — kein vollständiger Thread-Reload. */
export const GWADA_DASHBOARD_WAHA_METADATA_REFRESH_EVENT =
  "gwada:dashboard-waha-metadata-refresh";
export const GWADA_DASHBOARD_RESERVATIONS_REFRESH_EVENT =
  "gwada:dashboard-reservations-refresh";

export function dispatchDashboardWahaMetadataRefresh(): void {
  window.dispatchEvent(new Event(GWADA_DASHBOARD_WAHA_METADATA_REFRESH_EVENT));
}

export function dispatchDashboardReservationsRefresh(): void {
  window.dispatchEvent(new Event(GWADA_DASHBOARD_RESERVATIONS_REFRESH_EVENT));
}
