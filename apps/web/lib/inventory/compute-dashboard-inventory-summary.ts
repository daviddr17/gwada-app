import type { Ingredient } from "@/lib/types/inventory";
import type { PurchaseOrder } from "@/lib/types/purchase-order";
import { countPurchaseOrdersDeliveryDue } from "@/lib/inventory/purchase-order-delivery-due";
import { isIngredientActive } from "@/lib/inventory/low-stock";

export type DashboardInventorySummary = {
  ingredientsActive: number;
  emptyStock: number;
  /** Offen + Bestellt (handlungsrelevant) */
  openOrders: number;
  openOrderLines: number;
  /** Alle Bestellungen inkl. Abgeschlossen (für Widget-Liste) */
  allOrders: number;
  allOrderLines: number;
  /** Bestellt + Lieferdatum = heute (Restaurant-TZ) */
  deliveriesDueToday: number;
  /** Bestellt + Lieferdatum vor heute */
  deliveriesOverdue: number;
};

export function computeDashboardInventorySummary(
  ingredients: Ingredient[],
  orders: PurchaseOrder[],
  todayYmd?: string,
): DashboardInventorySummary {
  const active = ingredients.filter(isIngredientActive);
  const emptyStock = active.filter((i) => i.currentStock <= 0).length;
  const actionable = orders.filter(
    (o) => o.status === "open" || o.status === "ordered",
  );
  const openOrderLines = actionable.reduce((s, o) => s + o.lines.length, 0);
  const allOrderLines = orders.reduce((s, o) => s + o.lines.length, 0);
  const due =
    todayYmd && /^\d{4}-\d{2}-\d{2}$/.test(todayYmd)
      ? countPurchaseOrdersDeliveryDue(orders, todayYmd)
      : { deliveriesDueToday: 0, deliveriesOverdue: 0 };

  return {
    ingredientsActive: active.length,
    emptyStock,
    openOrders: actionable.length,
    openOrderLines,
    allOrders: orders.length,
    allOrderLines,
    deliveriesDueToday: due.deliveriesDueToday,
    deliveriesOverdue: due.deliveriesOverdue,
  };
}
