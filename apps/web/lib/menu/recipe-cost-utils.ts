import type { MenuRecipeLine } from "@/lib/types/menu";
import type { Ingredient } from "@/lib/types/inventory";

export type RecipeCostLine = {
  ingredientId: string;
  amount: number;
  unitPrice: number | null;
  lineCost: number | null;
};

export type RecipeCostResult = {
  lines: RecipeCostLine[];
  totalCost: number | null;
  allPriced: boolean;
};

function parsePositiveAmount(raw: string): number | null {
  const n = Number.parseFloat(raw.trim().replace(",", "."));
  if (Number.isNaN(n) || n <= 0) return null;
  return n;
}

export function computeRecipeCost(
  recipe: { ingredientId: string; amount: number | string }[],
  ingredientsById: Map<string, Ingredient>,
): RecipeCostResult {
  const lines: RecipeCostLine[] = [];
  let total = 0;
  let pricedCount = 0;
  let validLineCount = 0;

  for (const row of recipe) {
    if (!row.ingredientId.trim()) continue;
    const amount =
      typeof row.amount === "number"
        ? row.amount
        : parsePositiveAmount(row.amount);
    if (amount == null) continue;

    validLineCount += 1;
    const ing = ingredientsById.get(row.ingredientId);
    const unitPrice =
      ing?.purchaseUnitPrice != null && Number.isFinite(ing.purchaseUnitPrice)
        ? ing.purchaseUnitPrice
        : null;
    const lineCost = unitPrice != null ? amount * unitPrice : null;

    if (lineCost != null) {
      total += lineCost;
      pricedCount += 1;
    }

    lines.push({
      ingredientId: row.ingredientId,
      amount,
      unitPrice,
      lineCost,
    });
  }

  const allPriced = validLineCount > 0 && pricedCount === validLineCount;
  return {
    lines,
    totalCost: allPriced ? total : pricedCount > 0 ? total : null,
    allPriced,
  };
}

export function computeRecipeCostFromMenuLines(
  recipe: MenuRecipeLine[] | null | undefined,
  ingredientsById: Map<string, Ingredient>,
): RecipeCostResult {
  if (!recipe?.length) {
    return { lines: [], totalCost: null, allPriced: false };
  }
  return computeRecipeCost(recipe, ingredientsById);
}

/** Food-Cost in Prozent vom Verkaufspreis (VK). */
export function computeFoodCostPercent(
  recipeCost: number | null,
  sellPrice: number | null,
): number | null {
  if (
    recipeCost == null ||
    sellPrice == null ||
    !Number.isFinite(recipeCost) ||
    !Number.isFinite(sellPrice) ||
    sellPrice <= 0
  ) {
    return null;
  }
  return (recipeCost / sellPrice) * 100;
}

export function formatEuroAmount(value: number): string {
  return `${value.toFixed(2).replace(".", ",")} €`;
}
