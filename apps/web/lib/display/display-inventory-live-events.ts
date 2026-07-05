export const GWADA_DISPLAY_INVENTORY_REFRESH_EVENT =
  "gwada:display-inventory-refresh";

export function dispatchDisplayInventoryRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GWADA_DISPLAY_INVENTORY_REFRESH_EVENT));
}
