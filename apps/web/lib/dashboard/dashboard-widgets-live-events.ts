import type { DashboardBatchWidgetId } from "@/lib/dashboard/dashboard-batch-widgets";
import type {
  DashboardWidgetLiveFetchId,
  DashboardWidgetLiveSummaryMap,
} from "@/lib/dashboard/dashboard-widget-live-config";

export const GWADA_DASHBOARD_WIDGET_LIVE_PATCH_EVENT =
  "gwada:dashboard-widget-live-patch";

export type DashboardWidgetLivePatchDetail<
  W extends DashboardBatchWidgetId = DashboardBatchWidgetId,
> = {
  restaurantId: string;
  widget: W;
  /** Bereits aus Modul-Cache — kein Roundtrip. */
  summary?: W extends keyof DashboardWidgetLiveSummaryMap
    ? DashboardWidgetLiveSummaryMap[W]
    : never;
  /** Eigene Aktion — Fetch sofort statt debounced. */
  immediate?: boolean;
};

export function dispatchDashboardWidgetLivePatch<
  W extends DashboardBatchWidgetId,
>(detail: DashboardWidgetLivePatchDetail<W>): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(GWADA_DASHBOARD_WIDGET_LIVE_PATCH_EVENT, { detail }),
  );
}

export function dispatchDashboardWidgetLiveFetch(
  restaurantId: string,
  widget: DashboardWidgetLiveFetchId,
  options?: { immediate?: boolean },
): void {
  dispatchDashboardWidgetLivePatch({
    restaurantId,
    widget,
    immediate: options?.immediate,
  });
}
