/**
 * FULL-Route-Prefetch zuerst (gleiche Tick-Welle vor restlichen Priority-Routes).
 * Alle Sidebar-Routes folgen sofort danach — API-Warm bleibt KPI-gated.
 */
export const APP_MODULE_IMMEDIATE_FULL_ROUTES = [
  "/dashboard/menu/overview",
  "/dashboard/inventory/overview",
  "/dashboard/reservations/overview",
  "/dashboard/staff/overview",
  "/dashboard/contacts/messages?platform=all",
] as const;
