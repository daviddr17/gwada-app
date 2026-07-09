import type { Ingredient, InventoryTaxonomyDefinition } from "@/lib/types/inventory";
import type { PurchaseOrderLine } from "@/lib/types/purchase-order";
import { compareCategoryThenName } from "@/lib/inventory/sort-by-category";

export type PurchaseOrderLineSortKey =
  | "categoryId"
  | "ingredientName"
  | "brandLabel"
  | "currentStock"
  | "quantity"
  | "unitLabel";

export type PurchaseOrderLineSortDir = "asc" | "desc";

function ingredientCategoryId(
  ingredients: Ingredient[],
  ingredientId: string,
): string {
  return ingredients.find((i) => i.id === ingredientId)?.categoryId ?? "";
}

function ingredientCurrentStock(
  ingredients: Ingredient[],
  ingredientId: string,
): number {
  const hit = ingredients.find((i) => i.id === ingredientId);
  return hit?.currentStock ?? -1;
}

export function sortPurchaseOrderLines(
  lines: PurchaseOrderLine[],
  ingredients: Ingredient[],
  categories: InventoryTaxonomyDefinition[],
  sortKey: PurchaseOrderLineSortKey,
  sortDir: PurchaseOrderLineSortDir,
): PurchaseOrderLine[] {
  const dir = sortDir === "asc" ? 1 : -1;

  return [...lines].sort((a, b) => {
    switch (sortKey) {
      case "categoryId":
        return compareCategoryThenName(
          ingredientCategoryId(ingredients, a.ingredientId),
          a.ingredientName,
          ingredientCategoryId(ingredients, b.ingredientId),
          b.ingredientName,
          categories,
          dir,
        );
      case "ingredientName":
        return a.ingredientName.localeCompare(b.ingredientName, "de") * dir;
      case "brandLabel":
        return (a.brandLabel ?? "").localeCompare(b.brandLabel ?? "", "de") * dir;
      case "currentStock":
        return (
          (ingredientCurrentStock(ingredients, a.ingredientId) -
            ingredientCurrentStock(ingredients, b.ingredientId)) *
          dir
        );
      case "quantity":
        return (a.quantity - b.quantity) * dir;
      case "unitLabel":
        return a.unitLabel.localeCompare(b.unitLabel, "de") * dir;
      default:
        return 0;
    }
  });
}
