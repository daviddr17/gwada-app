import { isLineDeliveryResolved } from "./purchase-order-line-delivery";
import { isPurchaseOrderStatus } from "./purchase-order-status";
import type {
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderLineDeliveryStatus,
  PurchaseOrderLogEntry,
  PurchaseOrderStatus,
} from "../types/purchase-order";

const STATUS_RANK: Record<PurchaseOrderStatus, number> = {
  open: 0,
  ordered: 1,
  closed: 2,
};

export type RecoveredLineDelivery = {
  deliveredAt: string | null;
  deliveryStatus: PurchaseOrderLineDeliveryStatus | null;
  deliveredQuantity: number | null;
  deliveryNote: string | null;
};

export type PurchaseOrderRecoveryPatch = {
  orderId: string;
  supplierName: string;
  currentStatus: PurchaseOrderStatus;
  targetStatus: PurchaseOrderStatus;
  linePatches: Array<{
    lineId: string;
    ingredientName: string;
    current: Pick<
      PurchaseOrderLine,
      "deliveredAt" | "deliveryStatus" | "deliveredQuantity" | "deliveryNote"
    >;
    target: RecoveredLineDelivery;
  }>;
};

function chronologicalLog(log: readonly PurchaseOrderLogEntry[]): PurchaseOrderLogEntry[] {
  return [...log].sort((a, b) => a.at.localeCompare(b.at));
}

/** Last status_change wins — mirrors workflow progression in the app. */
export function derivePurchaseOrderStatusFromLog(
  log: readonly PurchaseOrderLogEntry[],
): PurchaseOrderStatus | null {
  let status: PurchaseOrderStatus | null = null;
  for (const entry of chronologicalLog(log)) {
    if (entry.kind !== "status_change") continue;
    if (!isPurchaseOrderStatus(entry.toStatus)) continue;
    status = entry.toStatus;
  }
  return status;
}

/** Replay marked_delivered / delivery_reverted for one line. */
export function deriveLineDeliveryFromLog(
  log: readonly PurchaseOrderLogEntry[],
  lineId: string,
): RecoveredLineDelivery | null {
  let resolved: RecoveredLineDelivery | null = null;

  for (const entry of chronologicalLog(log)) {
    if (entry.kind === "marked_delivered" && entry.lineId === lineId) {
      const deliveryStatus = entry.deliveryStatus ?? "delivered";
      resolved = {
        deliveredAt: entry.at,
        deliveryStatus,
        deliveredQuantity: entry.quantity,
        deliveryNote: entry.note?.trim() ? entry.note.trim() : null,
      };
      continue;
    }
    if (entry.kind === "delivery_reverted" && entry.lineId === lineId) {
      resolved = null;
    }
  }

  return resolved;
}

function lineDeliveryEquals(
  current: Pick<
    PurchaseOrderLine,
    "deliveredAt" | "deliveryStatus" | "deliveredQuantity" | "deliveryNote"
  >,
  target: RecoveredLineDelivery | null,
): boolean {
  if (!target) {
    return !isLineDeliveryResolved(current);
  }
  const curAt = current.deliveredAt ?? null;
  const curStatus = current.deliveryStatus ?? null;
  const curQty =
    typeof current.deliveredQuantity === "number" &&
    Number.isFinite(current.deliveredQuantity)
      ? current.deliveredQuantity
      : null;
  const curNote = current.deliveryNote?.trim() ? current.deliveryNote.trim() : null;

  return (
    curAt === target.deliveredAt &&
    curStatus === target.deliveryStatus &&
    curQty === target.deliveredQuantity &&
    curNote === target.deliveryNote
  );
}

/**
 * Detect PO rows where DB state regressed below what the protocol log proves.
 * Safe to run repeatedly — returns empty when already consistent.
 */
export function findPurchaseOrdersNeedingRecovery(
  orders: readonly PurchaseOrder[],
): PurchaseOrderRecoveryPatch[] {
  const patches: PurchaseOrderRecoveryPatch[] = [];

  for (const order of orders) {
    const targetStatus = derivePurchaseOrderStatusFromLog(order.log);
    const statusNeedsFix =
      targetStatus != null &&
      STATUS_RANK[targetStatus] > STATUS_RANK[order.status];

    const linePatches: PurchaseOrderRecoveryPatch["linePatches"] = [];
    for (const line of order.lines) {
      const targetDelivery = deriveLineDeliveryFromLog(order.log, line.id);
      const hasDeliveryInLog = targetDelivery != null;
      const lineNeedsFix =
        hasDeliveryInLog && !lineDeliveryEquals(line, targetDelivery);

      if (lineNeedsFix && targetDelivery) {
        linePatches.push({
          lineId: line.id,
          ingredientName: line.ingredientName,
          current: {
            deliveredAt: line.deliveredAt,
            deliveryStatus: line.deliveryStatus,
            deliveredQuantity: line.deliveredQuantity,
            deliveryNote: line.deliveryNote,
          },
          target: targetDelivery,
        });
      }
    }

    if (statusNeedsFix && targetStatus) {
      patches.push({
        orderId: order.id,
        supplierName: order.supplierName,
        currentStatus: order.status,
        targetStatus,
        linePatches,
      });
    } else if (linePatches.length > 0) {
      patches.push({
        orderId: order.id,
        supplierName: order.supplierName,
        currentStatus: order.status,
        targetStatus: order.status,
        linePatches,
      });
    }
  }

  return patches;
}
