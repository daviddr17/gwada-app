import assert from "node:assert/strict";
import { test } from "node:test";

import { mergeIngredientsForReplace } from "./merge-ingredients-for-replace.ts";
import type { Ingredient } from "@/lib/types/inventory";
import type { IngredientStockLogManual } from "@/lib/types/ingredient-stock-log";

function ingredient(
  partial: Partial<Ingredient> & Pick<Ingredient, "id">,
): Ingredient {
  return {
    name: "Tomaten",
    unit: "kg",
    currentStock: 10,
    supplierId: "sup-1",
    categoryId: "cat-1",
    productionSiteId: "site-1",
    brandId: "brand-1",
    active: true,
    stockLog: [],
    ...partial,
  };
}

function manualLog(
  partial: Partial<IngredientStockLogManual> & Pick<IngredientStockLogManual, "id" | "at">,
): IngredientStockLogManual {
  return {
    userFirstName: "Max",
    userLastName: "Muster",
    kind: "manual_stock",
    fromQuantity: 10,
    toQuantity: 8,
    unitId: "kg",
    unitLabel: "kg",
    ...partial,
  };
}

test("preserves DB ingredients missing from stale client snapshot", () => {
  const dbOnly = ingredient({
    id: "ing-db",
    currentStock: 5,
    stockLog: [
      manualLog({
        id: "log-1",
        at: "2026-01-02T00:00:00.000Z",
        fromQuantity: 6,
        toQuantity: 5,
      }),
    ],
  });
  const clientOnly = ingredient({ id: "ing-client", name: "Zwiebeln" });

  const merged = mergeIngredientsForReplace([dbOnly], [clientOnly]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find((i) => i.id === "ing-db")?.currentStock, 5);
  assert.equal(merged.find((i) => i.id === "ing-client")?.name, "Zwiebeln");
});

test("keeps DB row when client stockLog is stale", () => {
  const dbIng = ingredient({
    id: "ing-1",
    currentStock: 3,
    stockLog: [
      manualLog({
        id: "log-1",
        at: "2026-01-02T00:00:00.000Z",
        fromQuantity: 5,
        toQuantity: 3,
      }),
    ],
  });
  const staleClient = ingredient({
    id: "ing-1",
    currentStock: 5,
    stockLog: [],
  });

  const merged = mergeIngredientsForReplace([dbIng], [staleClient]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.currentStock, 3);
  assert.equal(merged[0]?.stockLog.length, 1);
});

test("applies client row when stockLog is newer than DB", () => {
  const dbIng = ingredient({
    id: "ing-1",
    currentStock: 5,
    stockLog: [
      manualLog({
        id: "log-1",
        at: "2026-01-01T00:00:00.000Z",
        fromQuantity: 6,
        toQuantity: 5,
      }),
    ],
  });
  const clientIng = ingredient({
    id: "ing-1",
    currentStock: 3,
    stockLog: [
      manualLog({
        id: "log-1",
        at: "2026-01-01T00:00:00.000Z",
        fromQuantity: 6,
        toQuantity: 5,
      }),
      manualLog({
        id: "log-2",
        at: "2026-01-02T00:00:00.000Z",
        fromQuantity: 5,
        toQuantity: 3,
      }),
    ],
  });

  const merged = mergeIngredientsForReplace([dbIng], [clientIng]);
  assert.equal(merged[0]?.currentStock, 3);
  assert.equal(merged[0]?.stockLog.length, 2);
});

test("prefers newer last log timestamp when lengths are equal", () => {
  const dbIng = ingredient({
    id: "ing-1",
    currentStock: 2,
    stockLog: [
      manualLog({
        id: "log-1",
        at: "2026-01-02T00:00:00.000Z",
        fromQuantity: 4,
        toQuantity: 2,
      }),
    ],
  });
  const staleClient = ingredient({
    id: "ing-1",
    currentStock: 4,
    stockLog: [
      manualLog({
        id: "log-1",
        at: "2026-01-01T00:00:00.000Z",
        fromQuantity: 5,
        toQuantity: 4,
      }),
    ],
  });

  const merged = mergeIngredientsForReplace([dbIng], [staleClient]);
  assert.equal(merged[0]?.currentStock, 2);
});

test("adds brand-new client ingredients not yet in DB", () => {
  const fresh = ingredient({
    id: "ing-new",
    name: "Salz",
    currentStock: 1,
  });

  const merged = mergeIngredientsForReplace([], [fresh]);
  assert.deepEqual(merged, [fresh]);
});
