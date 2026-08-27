import type { PurchaseOrder } from "@/lib/types/purchase-order";

export type PurchaseOrderDeliveryDueKind = "today" | "overdue";

export type PurchaseOrderDeliveryDue = {
  order: PurchaseOrder;
  kind: PurchaseOrderDeliveryDueKind;
};

/** Bestellt + Lieferdatum gesetzt und ≤ Restaurant-Heute. */
export function isPurchaseOrderDeliveryDue(
  order: Pick<PurchaseOrder, "status" | "deliveryDate">,
  todayYmd: string,
): boolean {
  if (order.status !== "ordered") return false;
  const d = order.deliveryDate?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return d <= todayYmd;
}

export function purchaseOrderDeliveryDueKind(
  deliveryDate: string,
  todayYmd: string,
): PurchaseOrderDeliveryDueKind {
  return deliveryDate === todayYmd ? "today" : "overdue";
}

export function listPurchaseOrdersDeliveryDue(
  orders: readonly PurchaseOrder[],
  todayYmd: string,
): PurchaseOrderDeliveryDue[] {
  const out: PurchaseOrderDeliveryDue[] = [];
  for (const order of orders) {
    if (!isPurchaseOrderDeliveryDue(order, todayYmd)) continue;
    const deliveryDate = order.deliveryDate!.trim();
    out.push({
      order,
      kind: purchaseOrderDeliveryDueKind(deliveryDate, todayYmd),
    });
  }
  out.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "overdue" ? -1 : 1;
    const da = a.order.deliveryDate ?? "";
    const db = b.order.deliveryDate ?? "";
    if (da !== db) return da.localeCompare(db);
    return a.order.supplierName.localeCompare(b.order.supplierName, "de");
  });
  return out;
}

export function countPurchaseOrdersDeliveryDue(
  orders: readonly Pick<PurchaseOrder, "status" | "deliveryDate">[],
  todayYmd: string,
): { deliveriesDueToday: number; deliveriesOverdue: number } {
  let deliveriesDueToday = 0;
  let deliveriesOverdue = 0;
  for (const order of orders) {
    if (!isPurchaseOrderDeliveryDue(order, todayYmd)) continue;
    const deliveryDate = order.deliveryDate!.trim();
    if (purchaseOrderDeliveryDueKind(deliveryDate, todayYmd) === "today") {
      deliveriesDueToday += 1;
    } else {
      deliveriesOverdue += 1;
    }
  }
  return { deliveriesDueToday, deliveriesOverdue };
}

export function formatPurchaseOrderDeliveryDueLabel(params: {
  deliveriesDueToday: number;
  deliveriesOverdue: number;
}): string | null {
  const { deliveriesDueToday, deliveriesOverdue } = params;
  if (deliveriesDueToday <= 0 && deliveriesOverdue <= 0) return null;
  const parts: string[] = [];
  if (deliveriesOverdue > 0) {
    parts.push(
      `${deliveriesOverdue} überfällig`,
    );
  }
  if (deliveriesDueToday > 0) {
    parts.push(
      `${deliveriesDueToday} heute`,
    );
  }
  return parts.join(" · ");
}
