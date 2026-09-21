import type { PurchaseOrder } from "@/lib/types/purchase-order";

/** Offene Bestellung ohne Positionen — soll nicht in der Liste bleiben. */
export function isEmptyOpenPurchaseOrder(order: PurchaseOrder): boolean {
  return order.status === "open" && order.lines.length === 0;
}

export function withoutEmptyOpenPurchaseOrders(
  orders: readonly PurchaseOrder[],
): PurchaseOrder[] {
  return orders.filter((order) => !isEmptyOpenPurchaseOrder(order));
}
