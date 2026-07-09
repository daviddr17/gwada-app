import type { InventoryTaxonomyDefinition } from "@/lib/types/inventory";

export function taxonomyNameById(
  items: InventoryTaxonomyDefinition[],
  id: string,
): string {
  const hit = items.find((i) => i.id === id);
  if (!hit) return "";
  return hit.active === false ? `${hit.name} (inaktiv)` : hit.name;
}

/** Kategorie alphabetisch, bei Gleichstand nach Name. */
export function compareCategoryThenName(
  categoryIdA: string,
  nameA: string,
  categoryIdB: string,
  nameB: string,
  categories: InventoryTaxonomyDefinition[],
  dir: 1 | -1 = 1,
): number {
  const cat =
    taxonomyNameById(categories, categoryIdA).localeCompare(
      taxonomyNameById(categories, categoryIdB),
      "de",
    ) * dir;
  if (cat !== 0) return cat;
  return nameA.localeCompare(nameB, "de") * dir;
}
