/**
 * FULL-Route-Prefetch zuerst (gleiche Tick-Welle vor restlichen Priority-Routes).
 * Alle Sidebar-Routes folgen sofort danach — API-Warm bleibt KPI-gated.
 */
export const APP_MODULE_IMMEDIATE_FULL_ROUTES = [
  "/dashboard/menu/uebersicht",
  "/dashboard/inventory/uebersicht",
  "/dashboard/reservierungen/uebersicht",
  "/dashboard/mitarbeiter/uebersicht",
  "/dashboard/kontakte/nachrichten?platform=all",
] as const;
