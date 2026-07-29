import type { PurchaseOrderStatus } from "@/lib/types/purchase-order";

export const PURCHASE_ORDER_STATUS_FILTERS = [
  "open",
  "ordered",
  "closed",
] as const satisfies readonly PurchaseOrderStatus[];

export type PurchaseOrderStatusFilter = (typeof PURCHASE_ORDER_STATUS_FILTERS)[number];

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  open: "Offen",
  ordered: "Bestellt",
  closed: "Abgeschlossen",
};

export function purchaseOrderStatusLabel(status: PurchaseOrderStatus): string {
  return PURCHASE_ORDER_STATUS_LABELS[status] ?? status;
}

export function isPurchaseOrderStatus(value: string): value is PurchaseOrderStatus {
  return value === "open" || value === "ordered" || value === "closed";
}

/** Mengen/Lieferdatum bearbeitbar (alles mit Protokoll). */
export function purchaseOrderAllowsEdits(status: PurchaseOrderStatus): boolean {
  return status === "open" || status === "ordered" || status === "closed";
}

/** Liefer-Antworten setzen (Bestellt + Abgeschlossen). */
export function purchaseOrderAllowsDeliveryActions(
  status: PurchaseOrderStatus,
): boolean {
  return status === "ordered" || status === "closed";
}

export function previousPurchaseOrderStatus(
  status: PurchaseOrderStatus,
): PurchaseOrderStatus | null {
  if (status === "closed") return "ordered";
  if (status === "ordered") return "open";
  return null;
}
