import type { Ingredient } from "@/lib/types/inventory";
import type { PurchaseOrder } from "@/lib/types/purchase-order";
import { countPurchaseOrdersDeliveryDue } from "@/lib/inventory/purchase-order-delivery-due";
import { isIngredientActive } from "@/lib/inventory/low-stock";

export { isEmptyStockVisibleInHeute } from "@/lib/inventory/low-stock";

export type DashboardInventorySummary = {
  ingredientsActive: number;
  emptyStock: number;
  /** Aus Heute ausgeblendet (noch leer, bis nach Auffüllung erneut 0). */
  emptyStockSnoozed: number;
  emptyStockSnoozedIngredientIds: string[];
  /** Offen + Bestellt (handlungsrelevant, z. B. Bestand-Kachel). */
  openOrders: number;
  /** Nur Status `open`. */
  ordersOpen: number;
  /** Nur Status `ordered`. */
  ordersOrdered: number;
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
  snoozedEmptyStockIngredientIds?: ReadonlySet<string>,
): DashboardInventorySummary {
  const active = ingredients.filter(isIngredientActive);
  const emptyActive = active.filter((i) => i.currentStock <= 0);
  const snoozed = snoozedEmptyStockIngredientIds ?? new Set<string>();
  const emptyStockSnoozed = emptyActive.filter((i) => snoozed.has(i.id)).length;
  const emptyStock = emptyActive.filter((i) => !snoozed.has(i.id)).length;
  const emptyStockSnoozedIngredientIds = emptyActive
    .filter((i) => snoozed.has(i.id))
    .map((i) => i.id);
  const ordersOpen = orders.filter((o) => o.status === "open").length;
  const ordersOrdered = orders.filter((o) => o.status === "ordered").length;
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
    emptyStockSnoozed,
    emptyStockSnoozedIngredientIds,
    openOrders: actionable.length,
    ordersOpen,
    ordersOrdered,
    openOrderLines,
    allOrders: orders.length,
    allOrderLines,
    deliveriesDueToday: due.deliveriesDueToday,
    deliveriesOverdue: due.deliveriesOverdue,
  };
}
