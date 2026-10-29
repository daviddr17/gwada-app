import { sortFoodMarkingCodes } from "@/lib/menu/food-marking-catalog";
import type { Ingredient } from "@/lib/types/inventory";
import type { MenuRecipeLine } from "@/lib/types/menu";

/**
 * Vereinigt Gericht-eigene Kennzeichnungen mit denen aller Rezept-Zutaten.
 */
export function aggregateDishMarkingCodes(params: {
  dishCodes?: readonly string[] | null;
  recipe?: readonly MenuRecipeLine[] | null;
  ingredientsById: Map<string, Pick<Ingredient, "markingCodes">>;
  countryIso2?: string | null;
}): string[] {
  const set = new Set<string>();
  for (const c of params.dishCodes ?? []) {
    if (c) set.add(c);
  }
  for (const line of params.recipe ?? []) {
    const ing = params.ingredientsById.get(line.ingredientId);
    for (const c of ing?.markingCodes ?? []) {
      if (c) set.add(c);
    }
  }
  return sortFoodMarkingCodes([...set], params.countryIso2);
}

/** Nur aus verknüpften Zutaten (ohne Gerichts-Overrides). */
export function markingCodesFromRecipeIngredients(params: {
  recipe?: readonly MenuRecipeLine[] | null;
  ingredientsById: Map<string, Pick<Ingredient, "markingCodes">>;
  countryIso2?: string | null;
}): string[] {
  return aggregateDishMarkingCodes({
    dishCodes: [],
    recipe: params.recipe,
    ingredientsById: params.ingredientsById,
    countryIso2: params.countryIso2,
  });
}
