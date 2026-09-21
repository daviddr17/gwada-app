import { isEmptyOpenPurchaseOrder } from "@/lib/inventory/prune-empty-open-purchase-orders";
import { dedupePurchaseOrdersById } from "@/lib/inventory/dedupe-purchase-orders-by-id";
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

export type MergePurchaseOrdersOptions = {
  /** Order IDs intentionally deleted (tombstones) — never keep or re-add. */
  deletedOrderIds?: ReadonlySet<string> | readonly string[];
};

function toDeletedSet(
  deleted?: ReadonlySet<string> | readonly string[],
): Set<string> {
  if (!deleted) return new Set();
  if (deleted instanceof Set) return deleted;
  return new Set(deleted);
}

/**
 * Merges a client-side purchase-order snapshot with the current DB rows before
 * `inventory_replace_purchase_orders` (full delete + insert).
 *
 * Prevents stale client caches from dropping closed/ordered orders, regressing
 * status, or losing line items when protocol entries already exist in DB.
 *
 * Empty open orders are dropped after reconcile (qty→0 / letzte Position weg).
 * Tombstoned IDs are never kept or re-added (absichtliche Löschung).
 */
export function mergePurchaseOrdersForReplace(
  dbOrders: readonly PurchaseOrder[],
  clientOrders: readonly PurchaseOrder[],
  options?: MergePurchaseOrdersOptions,
): PurchaseOrder[] {
  const deleted = toDeletedSet(options?.deletedOrderIds);
  const clientById = new Map(
    dedupePurchaseOrdersById(clientOrders).map((order) => [order.id, order]),
  );
  const merged: PurchaseOrder[] = [];
  const included = new Set<string>();

  for (const dbOrder of dbOrders) {
    if (deleted.has(dbOrder.id)) {
      continue;
    }
    const clientOrder = clientById.get(dbOrder.id);
    if (!clientOrder) {
      if (!isEmptyOpenPurchaseOrder(dbOrder)) {
        const reconciled = reconcilePurchaseOrderLinesFromLog(dbOrder);
        if (!isEmptyOpenPurchaseOrder(reconciled)) {
          merged.push(reconciled);
          included.add(dbOrder.id);
        }
      }
      continue;
    }

    const row = mergePurchaseOrderRow(dbOrder, clientOrder);
    if (!isEmptyOpenPurchaseOrder(row)) {
      merged.push(row);
      included.add(dbOrder.id);
    }
  }

  for (const clientOrder of clientOrders) {
    if (included.has(clientOrder.id) || deleted.has(clientOrder.id)) {
      continue;
    }
    const reconciled = reconcilePurchaseOrderLinesFromLog(clientOrder);
    if (!isEmptyOpenPurchaseOrder(reconciled)) {
      merged.push(reconciled);
    }
  }

  return merged;
}

function applyDeliveryFromMergedLog(
  lines: readonly PurchaseOrderLine[],
  log: readonly PurchaseOrderLogEntry[],
): PurchaseOrderLine[] {
  const latest = new Map<string, PurchaseOrderLogEntry>();
  for (const entry of [...log].sort((a, b) => a.at.localeCompare(b.at))) {
    if (
      entry.kind !== "marked_delivered" &&
      entry.kind !== "delivery_reverted"
    ) {
      continue;
    }
    if (entry.ingredientId) latest.set(entry.ingredientId, entry);
  }

  return lines.map((line) => {
    const event = latest.get(line.ingredientId);
    if (!event) return line;
    if (event.kind === "delivery_reverted") {
      return {
        ...line,
        deliveredAt: undefined,
        deliveryStatus: undefined,
        deliveredQuantity: undefined,
        deliveryNote: undefined,
      };
    }
    if (event.kind === "marked_delivered") {
      return {
        ...line,
        deliveredAt: event.at,
        deliveryStatus: event.deliveryStatus,
        deliveredQuantity: event.quantity,
        deliveryNote: event.note,
      };
    }
    return line;
  });
}

function mergePurchaseOrderRow(
  dbOrder: PurchaseOrder,
  clientOrder: PurchaseOrder,
): PurchaseOrder {
  const base = pickOrderBase(dbOrder, clientOrder);
  const log = mergePurchaseOrderLogs(dbOrder.log, clientOrder.log);
  const lines = applyDeliveryFromMergedLog(
    mergePurchaseOrderLines(dbOrder.lines, clientOrder.lines),
    log,
  );
  const statusFields = pickStatusByUpdatedAt(dbOrder, clientOrder);
  return reconcilePurchaseOrderLinesFromLog({
    ...base,
    ...statusFields,
    log,
    lines,
  });
}

/** Neuerer statusUpdatedAt gewinnt — erlaubt reopen und verhindert stale Regression. */
export function pickStatusByUpdatedAt(
  dbOrder: PurchaseOrder,
  clientOrder: PurchaseOrder,
): Pick<PurchaseOrder, "status" | "statusUpdatedAt"> {
  const dbAt = dbOrder.statusUpdatedAt ?? "";
  const clientAt = clientOrder.statusUpdatedAt ?? "";
  if (clientAt && dbAt && clientAt > dbAt) {
    return {
      status: clientOrder.status,
      statusUpdatedAt: clientAt,
    };
  }
  if (dbAt && (!clientAt || dbAt > clientAt)) {
    return {
      status: dbOrder.status,
      statusUpdatedAt: dbAt,
    };
  }
  if (clientAt && !dbAt) {
    return {
      status: clientOrder.status,
      statusUpdatedAt: clientAt,
    };
  }
  if (STATUS_RANK[dbOrder.status] >= STATUS_RANK[clientOrder.status]) {
    return {
      status: dbOrder.status,
      ...(dbAt || clientAt
        ? { statusUpdatedAt: dbAt || clientAt }
        : {}),
    };
  }
  return {
    status: clientOrder.status,
    ...(clientAt || dbAt
      ? { statusUpdatedAt: clientAt || dbAt }
      : {}),
  };
}

function mergePurchaseOrderLogs(
  dbLog: readonly PurchaseOrderLogEntry[],
  clientLog: readonly PurchaseOrderLogEntry[],
): PurchaseOrderLogEntry[] {
  const byId = new Map<string, PurchaseOrderLogEntry>();
  for (const entry of dbLog) {
    byId.set(entry.id, entry);
  }
  for (const entry of clientLog) {
    if (!byId.has(entry.id)) {
      byId.set(entry.id, entry);
    }
  }
  return [...byId.values()].sort((a, b) => a.at.localeCompare(b.at));
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
