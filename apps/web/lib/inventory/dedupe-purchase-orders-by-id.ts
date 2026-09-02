import type { PurchaseOrder } from "@/lib/types/purchase-order";

/** Last row wins — guards against duplicate ids in replace JSON (→ pkey violation). */
export function dedupePurchaseOrdersById(
  orders: readonly PurchaseOrder[],
): PurchaseOrder[] {
  const byId = new Map<string, PurchaseOrder>();
  for (const order of orders) {
    byId.set(order.id, order);
  }
  return Array.from(byId.values());
}
