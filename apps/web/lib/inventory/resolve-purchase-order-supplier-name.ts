import type { InventoryTaxonomyDefinition } from "@/lib/types/inventory";

/** Aktueller Klarname aus Taxonomie; Fallback Snapshot auf der Bestellung. */
export function resolvePurchaseOrderSupplierName(
  order: { supplierId: string; supplierName: string },
  suppliers: ReadonlyArray<Pick<InventoryTaxonomyDefinition, "id" | "name">>,
): string {
  const fromTaxonomy = suppliers
    .find((s) => s.id === order.supplierId)
    ?.name?.trim();
  if (fromTaxonomy) return fromTaxonomy;
  const snap = order.supplierName?.trim();
  if (snap) return snap;
  return order.supplierId || "Lieferant";
}

/**
 * Bestell-Snapshots an Stammdaten angleichen (z. B. nach Umbenennung unter Lieferanten
 * oder nach Bubble-Platzhalter „Lieferant 12345678“).
 */
export function applyTaxonomySupplierNamesToOrders<
  T extends { supplierId: string; supplierName: string },
>(
  orders: T[],
  suppliers: ReadonlyArray<Pick<InventoryTaxonomyDefinition, "id" | "name">>,
): { orders: T[]; changed: boolean } {
  let changed = false;
  const next = orders.map((order) => {
    const resolved = resolvePurchaseOrderSupplierName(order, suppliers);
    if (resolved === order.supplierName) return order;
    changed = true;
    return { ...order, supplierName: resolved };
  });
  return { orders: next, changed };
}
