import type {
  PurchaseOrderLine,
  PurchaseOrderLineDeliveryStatus,
} from "@/lib/types/purchase-order";

export const PURCHASE_ORDER_LINE_DELIVERY_LABELS: Record<
  PurchaseOrderLineDeliveryStatus,
  string
> = {
  delivered: "Geliefert",
  not_delivered: "Nicht geliefert",
  partial: "Abweichend",
};

export type ResolvedLineDelivery = {
  status: PurchaseOrderLineDeliveryStatus;
  deliveredQuantity: number;
  note: string;
  at: string | null;
};

/** Legacy: nur `deliveredAt` → voll geliefert. */
export function resolveLineDelivery(
  line: Pick<
    PurchaseOrderLine,
    "quantity" | "deliveredAt" | "deliveryStatus" | "deliveredQuantity" | "deliveryNote"
  >,
): ResolvedLineDelivery | null {
  const status = line.deliveryStatus;
  if (
    status !== "delivered" &&
    status !== "not_delivered" &&
    status !== "partial"
  ) {
    if (line.deliveredAt) {
      return {
        status: "delivered",
        deliveredQuantity: line.quantity,
        note: "",
        at: line.deliveredAt,
      };
    }
    return null;
  }

  let deliveredQuantity = 0;
  if (status === "delivered") {
    deliveredQuantity =
      typeof line.deliveredQuantity === "number" &&
      Number.isFinite(line.deliveredQuantity)
        ? line.deliveredQuantity
        : line.quantity;
  } else if (status === "partial") {
    deliveredQuantity =
      typeof line.deliveredQuantity === "number" &&
      Number.isFinite(line.deliveredQuantity)
        ? line.deliveredQuantity
        : 0;
  }

  return {
    status,
    deliveredQuantity,
    note: line.deliveryNote?.trim() ?? "",
    at: line.deliveredAt ?? null,
  };
}

export function isLineDeliveryResolved(
  line: Pick<
    PurchaseOrderLine,
    "deliveredAt" | "deliveryStatus"
  >,
): boolean {
  return resolveLineDelivery(line as PurchaseOrderLine) != null;
}

/** Bestandswirkung dieser Liefer-Antwort (0 wenn nicht geliefert / ungelöst). */
export function lineDeliveryStockQuantity(
  line: Pick<
    PurchaseOrderLine,
    "quantity" | "deliveredAt" | "deliveryStatus" | "deliveredQuantity" | "deliveryNote"
  >,
): number {
  const resolved = resolveLineDelivery(line);
  if (!resolved) return 0;
  if (resolved.status === "not_delivered") return 0;
  return Math.max(0, resolved.deliveredQuantity);
}

export function allPurchaseOrderLinesResolved(
  lines: readonly Pick<PurchaseOrderLine, "deliveredAt" | "deliveryStatus">[],
): boolean {
  if (lines.length === 0) return false;
  return lines.every((line) => isLineDeliveryResolved(line));
}
