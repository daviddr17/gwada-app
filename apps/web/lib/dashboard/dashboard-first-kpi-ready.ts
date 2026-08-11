"use client";

/** Nach erstem Dashboard-Stream-Widget — Modul-Warm starten ohne Batch zu blockieren. */
export const GWADA_DASHBOARD_FIRST_KPI_READY_EVENT =
  "gwada:dashboard-first-kpi-ready";

const notifiedRestaurants = new Set<string>();

export function notifyDashboardFirstKpiReady(restaurantId: string): void {
  if (typeof window === "undefined" || !restaurantId) return;
  if (notifiedRestaurants.has(restaurantId)) return;
  notifiedRestaurants.add(restaurantId);
  window.dispatchEvent(
    new CustomEvent(GWADA_DASHBOARD_FIRST_KPI_READY_EVENT, {
      detail: { restaurantId },
    }),
  );
}

export function onDashboardFirstKpiReady(
  restaurantId: string,
  callback: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  if (notifiedRestaurants.has(restaurantId)) {
    queueMicrotask(callback);
    return () => {};
  }
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ restaurantId?: string }>).detail;
    if (detail?.restaurantId !== restaurantId) return;
    callback();
  };
  window.addEventListener(GWADA_DASHBOARD_FIRST_KPI_READY_EVENT, handler);
  return () => {
    window.removeEventListener(GWADA_DASHBOARD_FIRST_KPI_READY_EVENT, handler);
  };
}

/** Tests / Restaurant-Wechsel. */
export function resetDashboardFirstKpiReadyForTests(): void {
  notifiedRestaurants.clear();
}
