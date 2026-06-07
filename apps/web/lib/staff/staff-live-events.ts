/** Mitarbeiter-Daten nach Realtime (Arbeitszeiten, Stammdaten) aktualisieren. */
export const GWADA_STAFF_DATA_REFRESH_EVENT = "gwada:staff-data-refresh";

export function dispatchStaffDataRefresh(): void {
  window.dispatchEvent(new Event(GWADA_STAFF_DATA_REFRESH_EVENT));
}
