/** Display-Reservierungsliste nach Live-Hinweis (Polling) aktualisieren. */
export const GWADA_DISPLAY_RESERVATIONS_REFRESH_EVENT =
  "gwada:display-reservations-refresh";

/** Sofort-Check nach PIN-Anmeldung / Entsperren (Auto-Sperre). */
export const GWADA_DISPLAY_RESERVATIONS_LIVE_SYNC_EVENT =
  "gwada:display-reservations-live-sync";

export function dispatchDisplayReservationsRefresh(): void {
  window.dispatchEvent(new Event(GWADA_DISPLAY_RESERVATIONS_REFRESH_EVENT));
}

/** Liste + Live-Signal-Baseline nach PIN (ohne Warten auf Intervall). */
export function syncDisplayReservationsLiveAfterPin(): void {
  dispatchDisplayReservationsRefresh();
  window.dispatchEvent(new Event(GWADA_DISPLAY_RESERVATIONS_LIVE_SYNC_EVENT));
}
