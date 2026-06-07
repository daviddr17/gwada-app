import type { MenuItem, MenuRecipeLine } from "@/lib/types/menu";
import { fuzzyTextMatchesQuery } from "@/lib/utils/fuzzy-search";

export function normalizeRecipeLines(
  raw: unknown,
): MenuRecipeLine[] | null {
  if (!Array.isArray(raw)) return null;
  const out: MenuRecipeLine[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    if (typeof o.ingredientId !== "string" || !o.ingredientId.trim()) continue;
    const amt =
      typeof o.amount === "number"
        ? o.amount
        : typeof o.amount === "string"
          ? Number.parseFloat(o.amount.replace(",", "."))
          : NaN;
    if (Number.isNaN(amt) || amt <= 0) continue;
    out.push({ ingredientId: o.ingredientId.trim(), amount: amt });
  }
  if (out.length === 0) return null;
  const merged = new Map<string, number>();
  for (const l of out) {
    merged.set(l.ingredientId, (merged.get(l.ingredientId) ?? 0) + l.amount);
  }
  return [...merged.entries()].map(([ingredientId, amount]) => ({
    ingredientId,
    amount,
  }));
}

export function getDishesUsingIngredient(
  ingredientId: string,
  menuItems: MenuItem[],
): MenuItem[] {
  return menuItems.filter((d) =>
    d.recipe?.some((r) => r.ingredientId === ingredientId),
  );
}

export function itemMatchesIngredientSearch(
  item: MenuItem,
  query: string,
  ingredientNameById: Map<string, string>,
): boolean {
  const q = query.trim();
  if (!q || !item.recipe?.length) return false;
  for (const line of item.recipe) {
    const name = ingredientNameById.get(line.ingredientId);
    if (name && fuzzyTextMatchesQuery(name, q)) return true;
  }
  return false;
}

export function ingredientRowMatchesDishSearch(
  ingredientId: string,
  ingredientName: string,
  query: string,
  menuItems: MenuItem[],
): boolean {
  const q = query.trim();
  if (!q) return true;
  if (fuzzyTextMatchesQuery(ingredientName, q)) return true;
  const dishes = getDishesUsingIngredient(ingredientId, menuItems);
  return dishes.some((d) => fuzzyTextMatchesQuery(d.name, q));
}
