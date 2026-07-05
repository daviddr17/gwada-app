"use client";

import { dispatchDashboardWidgetLivePatch } from "@/lib/dashboard/dashboard-widgets-live-events";
import { computeDashboardMenuSummary } from "@/lib/menu/compute-dashboard-menu-summary";
import { peekMenuCategoriesCache } from "@/lib/menu/menu-categories-query";
import { peekMenuItemsCache } from "@/lib/menu/menu-items-query";

/** Speisekarten-KPI sofort aus LS-Cache nach Gericht/Kategorie-Änderung. */
export function dispatchDashboardMenuLivePatchFromCache(
  restaurantId: string,
): void {
  const items = peekMenuItemsCache() ?? [];
  const categories = peekMenuCategoriesCache() ?? [];
  dispatchDashboardWidgetLivePatch({
    restaurantId,
    widget: "menu",
    summary: computeDashboardMenuSummary(items, categories),
  });
}
