import type { Ingredient } from "@/lib/types/inventory";
import type { PurchaseOrder } from "@/lib/types/purchase-order";

export type DashboardInventorySummary = {
  ingredientsActive: number;
  emptyStock: number;
  openOrders: number;
  openOrderLines: number;
};

export function computeDashboardInventorySummary(
  ingredients: Ingredient[],
  orders: PurchaseOrder[],
): DashboardInventorySummary {
  const active = ingredients.filter((i) => i.active !== false);
  const emptyStock = active.filter((i) => i.currentStock <= 0).length;
  const open = orders.filter((o) => o.status === "open");
  const openOrderLines = open.reduce((s, o) => s + o.lines.length, 0);

  return {
    ingredientsActive: active.length,
    emptyStock,
    openOrders: open.length,
    openOrderLines,
  };
}
