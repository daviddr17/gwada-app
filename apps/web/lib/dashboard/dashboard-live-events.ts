/** Dashboard-Widgets nach Realtime-Hinweis leicht aktualisieren (kein Voll-Polling). */
export const GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT =
  "gwada:dashboard-messages-refresh";
/** Nur WAHA-ACK/Reactions mergen — kein vollständiger Thread-Reload. */
export const GWADA_DASHBOARD_WAHA_METADATA_REFRESH_EVENT =
  "gwada:dashboard-waha-metadata-refresh";
export const GWADA_DASHBOARD_RESERVATIONS_REFRESH_EVENT =
  "gwada:dashboard-reservations-refresh";

export function dispatchDashboardMessagesRefresh(): void {
  window.dispatchEvent(new Event(GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT));
}

export function dispatchDashboardWahaMetadataRefresh(): void {
  window.dispatchEvent(new Event(GWADA_DASHBOARD_WAHA_METADATA_REFRESH_EVENT));
}

export function dispatchDashboardReservationsRefresh(): void {
  window.dispatchEvent(new Event(GWADA_DASHBOARD_RESERVATIONS_REFRESH_EVENT));
}
