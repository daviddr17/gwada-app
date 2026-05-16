import type { MenuCategoryDefinition, MenuItem } from "@/lib/types/menu";
import { normalizeRecipeLines } from "@/lib/menu/recipe-utils";

export function isMenuItemActive(item: MenuItem): boolean {
  return item.active !== false;
}

export function isCategoryActive(cat: MenuCategoryDefinition): boolean {
  return cat.active !== false;
}

/** Sortierung innerhalb einer Kategorie: Nummer, dann Name. */
export function sortItemsInCategoryForDisplay(items: MenuItem[]): MenuItem[] {
  return [...items].sort((a, b) => {
    const an = a.listNumber;
    const bn = b.listNumber;
    if (an != null && bn != null && an !== bn) return an - bn;
    if (an != null && bn == null) return -1;
    if (an == null && bn != null) return 1;
    return a.name.localeCompare(b.name, "de");
  });
}

export function normalizeMenuItem(
  raw: Record<string, unknown>,
  fallbackId?: string,
): MenuItem | null {
  if (
    typeof raw.name !== "string" ||
    typeof raw.description !== "string" ||
    typeof raw.price !== "number" ||
    typeof raw.category !== "string" ||
    typeof raw.imageUrl !== "string" ||
    !Array.isArray(raw.tags)
  ) {
    return null;
  }
  const id =
    typeof raw.id === "string"
      ? raw.id
      : fallbackId ?? `m-${Date.now().toString(36)}`;
  const listNum = raw.listNumber;
  const recipe = normalizeRecipeLines(raw.recipe);
  return {
    id,
    name: raw.name,
    description: raw.description,
    price: raw.price,
    category: raw.category,
    imageUrl: raw.imageUrl,
    tags: raw.tags as MenuItem["tags"],
    active: raw.active === false ? false : true,
    listNumber:
      typeof listNum === "number" && !Number.isNaN(listNum) ? listNum : null,
    recipe: recipe ?? undefined,
  };
}
