/** Dashboard-Widgets nach Realtime-Hinweis leicht aktualisieren (kein Voll-Polling). */
export const GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT =
  "gwada:dashboard-messages-refresh";
export const GWADA_DASHBOARD_RESERVATIONS_REFRESH_EVENT =
  "gwada:dashboard-reservations-refresh";

export function dispatchDashboardMessagesRefresh(): void {
  window.dispatchEvent(new Event(GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT));
}

export function dispatchDashboardReservationsRefresh(): void {
  window.dispatchEvent(new Event(GWADA_DASHBOARD_RESERVATIONS_REFRESH_EVENT));
}
