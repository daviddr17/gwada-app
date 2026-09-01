import { isEmptyOpenPurchaseOrder } from "@/lib/inventory/prune-empty-open-purchase-orders";
import type { PurchaseOrder, PurchaseOrderStatus } from "@/lib/types/purchase-order";

const STATUS_RANK: Record<PurchaseOrderStatus, number> = {
  open: 0,
  ordered: 1,
  closed: 2,
};

/**
 * Merges a client-side purchase-order snapshot with the current DB rows before
 * `inventory_replace_purchase_orders` (full delete + insert).
 *
 * Prevents stale client caches from dropping closed/ordered orders or regressing
 * their status when another session already advanced the workflow.
 */
export function mergePurchaseOrdersForReplace(
  dbOrders: readonly PurchaseOrder[],
  clientOrders: readonly PurchaseOrder[],
): PurchaseOrder[] {
  const clientById = new Map(clientOrders.map((order) => [order.id, order]));
  const merged: PurchaseOrder[] = [];
  const included = new Set<string>();

  for (const dbOrder of dbOrders) {
    const clientOrder = clientById.get(dbOrder.id);
    if (!clientOrder) {
      if (!isEmptyOpenPurchaseOrder(dbOrder)) {
        merged.push(dbOrder);
        included.add(dbOrder.id);
      }
      continue;
    }

    merged.push(mergePurchaseOrderRow(dbOrder, clientOrder));
    included.add(dbOrder.id);
  }

  for (const clientOrder of clientOrders) {
    if (!included.has(clientOrder.id)) {
      merged.push(clientOrder);
    }
  }

  return merged;
}

function mergePurchaseOrderRow(
  dbOrder: PurchaseOrder,
  clientOrder: PurchaseOrder,
): PurchaseOrder {
  if (clientOrder.log.length > dbOrder.log.length) {
    return clientOrder;
  }
  if (clientOrder.log.length < dbOrder.log.length) {
    return dbOrder;
  }

  if (STATUS_RANK[dbOrder.status] > STATUS_RANK[clientOrder.status]) {
    return dbOrder;
  }

  return clientOrder;
}
