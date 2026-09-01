import { isEmptyOpenPurchaseOrder } from "@/lib/inventory/prune-empty-open-purchase-orders";
import { reconcilePurchaseOrderLinesFromLog } from "@/lib/inventory/reconcile-purchase-order-lines-from-log";
import type {
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderLogEntry,
  PurchaseOrderStatus,
} from "@/lib/types/purchase-order";

const STATUS_RANK: Record<PurchaseOrderStatus, number> = {
  open: 0,
  ordered: 1,
  closed: 2,
};

function lastLogAt(log: readonly PurchaseOrderLogEntry[]): string | null {
  if (log.length === 0) return null;
  return log[log.length - 1]?.at ?? null;
}

/**
 * Merges a client-side purchase-order snapshot with the current DB rows before
 * `inventory_replace_purchase_orders` (full delete + insert).
 *
 * Prevents stale client caches from dropping closed/ordered orders, regressing
 * status, or losing line items when protocol entries already exist in DB.
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
        merged.push(reconcilePurchaseOrderLinesFromLog(dbOrder));
        included.add(dbOrder.id);
      }
      continue;
    }

    merged.push(mergePurchaseOrderRow(dbOrder, clientOrder));
    included.add(dbOrder.id);
  }

  for (const clientOrder of clientOrders) {
    if (!included.has(clientOrder.id)) {
      merged.push(reconcilePurchaseOrderLinesFromLog(clientOrder));
    }
  }

  return merged;
}

function mergePurchaseOrderRow(
  dbOrder: PurchaseOrder,
  clientOrder: PurchaseOrder,
): PurchaseOrder {
  const base = pickOrderBase(dbOrder, clientOrder);
  const lines = mergePurchaseOrderLines(dbOrder.lines, clientOrder.lines);
  return reconcilePurchaseOrderLinesFromLog({
    ...base,
    lines,
  });
}

function pickOrderBase(
  dbOrder: PurchaseOrder,
  clientOrder: PurchaseOrder,
): PurchaseOrder {
  if (clientOrder.log.length > dbOrder.log.length) {
    return clientOrder;
  }
  if (clientOrder.log.length < dbOrder.log.length) {
    return dbOrder;
  }

  const dbLast = lastLogAt(dbOrder.log);
  const clientLast = lastLogAt(clientOrder.log);
  if (dbLast && clientLast) {
    if (dbLast > clientLast) return dbOrder;
    if (clientLast > dbLast) return clientOrder;
  } else if (dbLast && !clientLast) {
    return dbOrder;
  } else if (clientLast && !dbLast) {
    return clientOrder;
  }

  if (STATUS_RANK[dbOrder.status] > STATUS_RANK[clientOrder.status]) {
    return dbOrder;
  }

  return clientOrder;
}

function mergePurchaseOrderLines(
  dbLines: readonly PurchaseOrderLine[],
  clientLines: readonly PurchaseOrderLine[],
): PurchaseOrderLine[] {
  const byIngredient = new Map<string, PurchaseOrderLine>();

  for (const line of dbLines) {
    byIngredient.set(line.ingredientId, { ...line });
  }

  for (const line of clientLines) {
    const prev = byIngredient.get(line.ingredientId);
    if (!prev) {
      byIngredient.set(line.ingredientId, { ...line });
      continue;
    }
    byIngredient.set(line.ingredientId, {
      ...prev,
      ...line,
      id: prev.id,
      quantity: Math.max(prev.quantity, line.quantity),
      deliveredAt: prev.deliveredAt ?? line.deliveredAt,
      deliveryStatus: prev.deliveryStatus ?? line.deliveryStatus,
      deliveredQuantity: prev.deliveredQuantity ?? line.deliveredQuantity,
      deliveryNote: prev.deliveryNote ?? line.deliveryNote,
    });
  }

  return Array.from(byIngredient.values());
}
