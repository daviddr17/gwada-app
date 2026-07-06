import type { DashboardBatchWidgetId } from "@/lib/dashboard/dashboard-batch-widgets";
import type { InventoryTaxonomyDbTable } from "@/lib/constants/inventory-taxonomy-tables";

export const queryKeys = {
  menu: {
    root: (restaurantId: string) => ["menu", restaurantId] as const,
    items: (restaurantId: string) => ["menu", restaurantId, "items"] as const,
    categories: (restaurantId: string) =>
      ["menu", restaurantId, "categories"] as const,
    mainCategories: (restaurantId: string) =>
      ["menu", restaurantId, "main-categories"] as const,
    taxonomy: (restaurantId: string, kind: "tags" | "allergens") =>
      ["menu", restaurantId, "taxonomy", kind] as const,
  },
  inventory: {
    root: (restaurantId: string) => ["inventory", restaurantId] as const,
    ingredients: (restaurantId: string) =>
      ["inventory", restaurantId, "ingredients"] as const,
    purchaseOrders: (restaurantId: string) =>
      ["inventory", restaurantId, "purchase-orders"] as const,
    taxonomy: (restaurantId: string, table: InventoryTaxonomyDbTable) =>
      ["inventory", restaurantId, "taxonomy", table] as const,
  },
  dashboard: {
    summary: (restaurantId: string, widgets: readonly DashboardBatchWidgetId[]) =>
      ["dashboard", "summary", restaurantId, widgets.join(",")] as const,
    /** Invalidiert alle Widget-Kombinationen für ein Restaurant. */
    summaryRoot: (restaurantId: string) =>
      ["dashboard", "summary", restaurantId] as const,
  },
  notifications: {
    summary: (restaurantId: string) =>
      ["notifications", "summary", restaurantId] as const,
    summaryRoot: (restaurantId: string) =>
      ["notifications", "summary", restaurantId] as const,
  },
} as const;
