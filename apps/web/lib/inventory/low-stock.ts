import type { Ingredient } from "@/lib/types/inventory";

export function ingredientLowStockThreshold(
  ingredient: Pick<Ingredient, "lowStockThreshold">,
): number {
  const t = ingredient.lowStockThreshold;
  return typeof t === "number" && Number.isFinite(t) && t >= 0 ? t : 0;
}

export function isIngredientLowStock(
  ingredient: Pick<Ingredient, "currentStock" | "lowStockThreshold" | "active">,
): boolean {
  if (ingredient.active === false) return false;
  return ingredient.currentStock <= ingredientLowStockThreshold(ingredient);
}
