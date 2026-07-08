import type { DisplayInventoryIngredientRow } from "@/lib/display/display-inventory-server";
import type { Ingredient } from "@/lib/types/inventory";

/** Display-Zeilen für katalogbasiertes Sprach-Matching. */
export function displayInventoryRowsToIngredients(
  rows: DisplayInventoryIngredientRow[],
): Ingredient[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    unit: row.unitId,
    currentStock: row.currentStock,
    supplierId: row.supplierId,
    categoryId: row.categoryId,
    productionSiteId: row.productionSiteId,
    brandId: row.brandId,
    active: true,
    stockLog: [],
  }));
}

export function displayInventoryOpenLineContext(
  rows: DisplayInventoryIngredientRow[],
  supplierId: string,
  ingredientId: string,
) {
  const row = rows.find((r) => r.id === ingredientId);
  if (!row || row.supplierId !== supplierId) {
    return { orderId: null, lineId: null, quantity: 0 };
  }
  return {
    orderId: row.orderId,
    lineId: row.orderLineId,
    quantity: row.orderLineId ? row.orderQuantity : 0,
  };
}

export async function applyDisplayInventoryStockVoiceLines(
  lines: Array<{ ingredientId: string; quantity: number }>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const line of lines) {
    const res = await fetch("/api/display/inventory/stock", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ingredient_id: line.ingredientId,
        current_stock: line.quantity,
      }),
    });
    if (!res.ok) {
      return { ok: false, error: "Bestand konnte nicht gespeichert werden." };
    }
  }
  return { ok: true };
}

export async function applyDisplayInventoryOrderVoiceLines(
  lines: Array<{ ingredientId: string; quantity: number }>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const line of lines) {
    const res = await fetch("/api/display/inventory/order-line", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ingredient_id: line.ingredientId,
        quantity: line.quantity,
      }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      if (err.error === "no_supplier") {
        return {
          ok: false,
          error:
            "Diese Zutat hat keinen Lieferanten und kann nicht bestellt werden.",
        };
      }
      return { ok: false, error: "Bestellmenge konnte nicht gespeichert werden." };
    }
  }
  return { ok: true };
}
