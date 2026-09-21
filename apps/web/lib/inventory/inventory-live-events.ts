/** Bestand/Bestellungen nach Realtime (Zutaten, PO-Zeilen, Protokoll) aktualisieren. */
export const GWADA_INVENTORY_DATA_REFRESH_EVENT = "gwada:inventory-data-refresh";

export function dispatchInventoryDataRefresh(): void {
  window.dispatchEvent(new Event(GWADA_INVENTORY_DATA_REFRESH_EVENT));
}
