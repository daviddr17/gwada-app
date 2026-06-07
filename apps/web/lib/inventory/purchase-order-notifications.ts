"use client";

import { toast } from "sonner";

function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : String(qty).replace(".", ",");
}

function qtyUnit(qty: number, unitLabel: string): string {
  const u = unitLabel.trim();
  return u ? `${formatQty(qty)} ${u}` : formatQty(qty);
}

/** Neue offene Bestellung für einen Lieferanten (erste Position). */
export function toastPurchaseOrderOpened(
  supplierName: string,
  ingredientName: string,
  qty: number,
  unitLabel: string,
): void {
  toast.success(`Bestellung für „${supplierName}“ eröffnet.`, {
    description: `„${ingredientName}“: ${qtyUnit(qty, unitLabel)}`,
    id: `po-opened-${supplierName}`,
  });
}

/** Position zur bestehenden offenen Bestellung hinzugefügt. */
export function toastPurchaseOrderLineAdded(
  supplierName: string,
  ingredientName: string,
  qty: number,
  unitLabel: string,
): void {
  toast.success("Bestellung angepasst.", {
    description: `„${ingredientName}“ zur offenen Bestellung („${supplierName}“) hinzugefügt: ${qtyUnit(qty, unitLabel)}`,
    id: `po-line-add-${ingredientName}`,
  });
}

/** Menge einer bestehenden Position erhöht (Bestand-Übersicht, erneuter Eintrag). */
export function toastPurchaseOrderQuantityIncreased(
  ingredientName: string,
  newTotal: number,
  unitLabel: string,
): void {
  toast.success("Bestellung angepasst.", {
    description: `„${ingredientName}“: Menge auf ${qtyUnit(newTotal, unitLabel)}`,
    id: `po-qty-inc-${ingredientName}`,
  });
}

/** Menge in offener Bestellung geändert (Bestand-Spalte „Bestellung“). */
export function toastPurchaseOrderQuantityChanged(
  ingredientName: string,
  qty: number,
  unitLabel: string,
): void {
  toast.success("Bestellung angepasst.", {
    description: `„${ingredientName}“: ${qtyUnit(qty, unitLabel)}`,
    id: `po-qty-changed-${ingredientName}`,
  });
}

/** Position aus offener Bestellung entfernt (Menge 0). */
export function toastPurchaseOrderLineRemoved(ingredientName: string): void {
  toast.success("Bestellung angepasst.", {
    description: `„${ingredientName}“ aus der Bestellung entfernt.`,
    id: `po-line-removed-${ingredientName}`,
  });
}
