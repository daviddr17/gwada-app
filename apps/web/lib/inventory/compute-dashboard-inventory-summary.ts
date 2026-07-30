import type { Ingredient } from "@/lib/types/inventory";
import type { PurchaseOrder } from "@/lib/types/purchase-order";

export type DashboardInventorySummary = {
  ingredientsActive: number;
  emptyStock: number;
  /** Offen + Bestellt (handlungsrelevant) */
  openOrders: number;
  openOrderLines: number;
  /** Alle Bestellungen inkl. Abgeschlossen (für Widget-Liste) */
  allOrders: number;
  allOrderLines: number;
};

export function computeDashboardInventorySummary(
  ingredients: Ingredient[],
  orders: PurchaseOrder[],
): DashboardInventorySummary {
  const active = ingredients.filter((i) => i.active !== false);
  const emptyStock = active.filter((i) => i.currentStock <= 0).length;
  const actionable = orders.filter(
    (o) => o.status === "open" || o.status === "ordered",
  );
  const openOrderLines = actionable.reduce((s, o) => s + o.lines.length, 0);
  const allOrderLines = orders.reduce((s, o) => s + o.lines.length, 0);

  return {
    ingredientsActive: active.length,
    emptyStock,
    openOrders: actionable.length,
    openOrderLines,
    allOrders: orders.length,
    allOrderLines,
  };
}
