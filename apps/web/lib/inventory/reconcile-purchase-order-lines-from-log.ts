import { createId } from "@/lib/create-id";
import type {
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderLogEntry,
} from "@/lib/types/purchase-order";

function sortLogChronologically(
  log: readonly PurchaseOrderLogEntry[],
): PurchaseOrderLogEntry[] {
  return [...log].sort((a, b) => a.at.localeCompare(b.at));
}

function impliedQuantityFromLog(
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

function templateFromLog(
  log: readonly PurchaseOrderLogEntry[],
  ingredientId: string,
): Pick<
  PurchaseOrderLine,
  "ingredientId" | "ingredientName" | "unitId" | "unitLabel" | "brandLabel"
> | null {
  for (let i = log.length - 1; i >= 0; i -= 1) {
    const entry = log[i];
    if (!entry || entry.ingredientId !== ingredientId) continue;
    if (
      entry.kind === "add_to_order" ||
      entry.kind === "quantity_change" ||
      entry.kind === "legacy_adjustment"
    ) {
      return {
        ingredientId: entry.ingredientId,
        ingredientName: entry.ingredientName,
        unitId: entry.unitId,
        unitLabel: entry.unitLabel,
      };
    }
  }
  return null;
}

function ingredientIdsFromLog(log: readonly PurchaseOrderLogEntry[]): string[] {
  const ids = new Set<string>();
  for (const entry of log) {
    if (!entry.ingredientId) continue;
    if (
      entry.kind === "add_to_order" ||
      entry.kind === "quantity_change" ||
      entry.kind === "legacy_adjustment"
    ) {
      ids.add(entry.ingredientId);
    }
  }
  return Array.from(ids);
}

function rebuildOpenLinesFromLog(order: PurchaseOrder): PurchaseOrderLine[] {
  const existingByIngredient = new Map(
    order.lines.map((line) => [line.ingredientId, line]),
  );
  const lines: PurchaseOrderLine[] = [];

  for (const ingredientId of ingredientIdsFromLog(order.log)) {
    const impliedQty = impliedQuantityFromLog(order.log, ingredientId);
    if (impliedQty == null || impliedQty <= 0) continue;
    const template = templateFromLog(order.log, ingredientId);
    if (!template) continue;
    const prev = existingByIngredient.get(ingredientId);
    lines.push({
      id: prev?.id ?? createId(),
      ingredientId: template.ingredientId,
      ingredientName: template.ingredientName,
      brandLabel: prev?.brandLabel ?? template.brandLabel,
      quantity: impliedQty,
      unitId: template.unitId,
      unitLabel: template.unitLabel,
    });
  }

  return lines;
}

function reconcileNonOpenLinesFromLog(order: PurchaseOrder): PurchaseOrder {
  const existingByIngredient = new Map(
    order.lines.map((line) => [line.ingredientId, line]),
  );
  const nextLines = order.lines.map((line) => ({ ...line }));
  let changed = false;

  for (const ingredientId of ingredientIdsFromLog(order.log)) {
    const impliedQty = impliedQuantityFromLog(order.log, ingredientId);
    if (impliedQty == null || impliedQty <= 0) continue;
    const existing = existingByIngredient.get(ingredientId);
    if (existing) {
      if (existing.quantity < impliedQty) {
        const idx = nextLines.findIndex((l) => l.ingredientId === ingredientId);
        if (idx >= 0) {
          nextLines[idx] = { ...nextLines[idx]!, quantity: impliedQty };
          changed = true;
        }
      }
      continue;
    }
    const template = templateFromLog(order.log, ingredientId);
    if (!template) continue;
    nextLines.push({
      id: createId(),
      ingredientId: template.ingredientId,
      ingredientName: template.ingredientName,
      brandLabel: template.brandLabel,
      quantity: impliedQty,
      unitId: template.unitId,
      unitLabel: template.unitLabel,
      deliveredAt: undefined,
      deliveryStatus: undefined,
      deliveredQuantity: undefined,
      deliveryNote: undefined,
    });
    changed = true;
  }

  return changed ? { ...order, lines: nextLines } : order;
}

/**
 * Aligns order lines with protocol entries (add / quantity / legacy).
 * Open orders: full rebuild from log. Ordered/closed: add missing + raise qty only.
 */
export function reconcilePurchaseOrderLinesFromLog(
  order: PurchaseOrder,
): PurchaseOrder {
  if (order.log.length === 0) {
    return order;
  }

  if (order.status === "open") {
    const lines = rebuildOpenLinesFromLog(order);
    if (
      lines.length === order.lines.length &&
      lines.every((line) => {
        const prev = order.lines.find((l) => l.ingredientId === line.ingredientId);
        return prev && prev.quantity === line.quantity;
      })
    ) {
      return order;
    }
    return { ...order, lines };
  }

  return reconcileNonOpenLinesFromLog(order);
}

export function purchaseOrderLinesDifferAfterReconcile(
  before: PurchaseOrder,
  after: PurchaseOrder,
): boolean {
  if (before.lines.length !== after.lines.length) return true;
  return after.lines.some((line) => {
    const prev = before.lines.find((l) => l.ingredientId === line.ingredientId);
    return !prev || prev.quantity !== line.quantity;
  });
}
