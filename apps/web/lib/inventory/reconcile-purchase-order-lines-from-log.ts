import { createId } from "@/lib/create-id";
import type {
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderLogAdd,
  PurchaseOrderLogEntry,
} from "@/lib/types/purchase-order";

function sortLogChronologically(
  log: readonly PurchaseOrderLogEntry[],
): PurchaseOrderLogEntry[] {
  return [...log].sort((a, b) => a.at.localeCompare(b.at));
}

function lastQuantityForIngredient(
  log: readonly PurchaseOrderLogEntry[],
  ingredientId: string,
): number | null {
  let quantity: number | null = null;
  for (const entry of sortLogChronologically(log)) {
    if (entry.ingredientId !== ingredientId) continue;
    switch (entry.kind) {
      case "add_to_order":
        quantity = (quantity ?? 0) + entry.quantity;
        break;
      case "quantity_change":
        quantity = entry.toQuantity;
        break;
      case "legacy_adjustment":
        quantity = Math.max(0, (quantity ?? 0) + entry.quantityDelta);
        break;
      default:
        break;
    }
  }
  return quantity;
}

/**
 * Adds missing line items implied by protocol entries without rewriting existing lines.
 */
export function reconcilePurchaseOrderLinesFromLog(
  order: PurchaseOrder,
): PurchaseOrder {
  const linesByIngredient = new Map(
    order.lines.map((line) => [line.ingredientId, line]),
  );
  const missingAdds = new Map<string, PurchaseOrderLogAdd[]>();

  for (const entry of order.log) {
    if (entry.kind !== "add_to_order") continue;
    if (linesByIngredient.has(entry.ingredientId)) continue;
    const bucket = missingAdds.get(entry.ingredientId) ?? [];
    bucket.push(entry);
    missingAdds.set(entry.ingredientId, bucket);
  }

  if (missingAdds.size === 0) {
    return order;
  }

  const addedLines: PurchaseOrderLine[] = [];
  for (const [ingredientId, entries] of missingAdds) {
    const impliedQty = lastQuantityForIngredient(order.log, ingredientId);
    if (impliedQty == null || impliedQty <= 0) continue;
    const template = entries[entries.length - 1];
    if (!template) continue;
    addedLines.push({
      id: createId(),
      ingredientId,
      ingredientName: template.ingredientName,
      quantity: impliedQty,
      unitId: template.unitId,
      unitLabel: template.unitLabel,
    });
  }

  if (addedLines.length === 0) {
    return order;
  }

  return { ...order, lines: [...order.lines, ...addedLines] };
}
