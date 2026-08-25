import type {
  MenuCategoryDefinition,
  MenuMainCategoryDefinition,
} from "@/lib/types/menu";

function mainCategoryNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Doppelte Hauptkategorien (z. B. zweimal „Speisen“) auf eine Zeile pro Name reduzieren.
 * Behält die Zeile mit den meisten verknüpften Kategorien, sonst erste sort_order.
 */
export function dedupeMenuMainCategories(
  rows: MenuMainCategoryDefinition[],
  categories: MenuCategoryDefinition[] = [],
): MenuMainCategoryDefinition[] {
  if (rows.length <= 1) return rows;

  const categoryCountByMainId = new Map<string, number>();
  for (const cat of categories) {
    const id = cat.mainCategoryId;
    if (!id) continue;
    categoryCountByMainId.set(id, (categoryCountByMainId.get(id) ?? 0) + 1);
  }

  const bestByName = new Map<string, MenuMainCategoryDefinition>();
  for (const row of rows) {
    const key = mainCategoryNameKey(row.name);
    const existing = bestByName.get(key);
    if (!existing) {
      bestByName.set(key, row);
      continue;
    }
    const rowScore = categoryCountByMainId.get(row.id) ?? 0;
    const existingScore = categoryCountByMainId.get(existing.id) ?? 0;
    if (rowScore > existingScore) {
      bestByName.set(key, row);
    }
  }

  const canonicalIds = new Set(
    [...bestByName.values()].map((row) => row.id),
  );
  return rows.filter((row) => canonicalIds.has(row.id));
}

/** Kategorie-`mainCategoryId` auf die kanonische Hauptkategorie pro Name mappen. */
export function remapCategoryMainCategoryIds(
  categories: MenuCategoryDefinition[],
  mainCategories: MenuMainCategoryDefinition[],
): MenuCategoryDefinition[] {
  if (mainCategories.length <= 1) return categories;

  const canonicalByName = new Map<string, string>();
  for (const main of dedupeMenuMainCategories(mainCategories, categories)) {
    canonicalByName.set(mainCategoryNameKey(main.name), main.id);
  }

  const idToName = new Map(
    mainCategories.map((main) => [main.id, mainCategoryNameKey(main.name)]),
  );

  return categories.map((cat) => {
    const mainCategoryId = cat.mainCategoryId;
    if (!mainCategoryId) return cat;
    const nameKey = idToName.get(mainCategoryId);
    if (!nameKey) return cat;
    const canonicalId = canonicalByName.get(nameKey);
    if (!canonicalId || canonicalId === mainCategoryId) return cat;
    return { ...cat, mainCategoryId: canonicalId };
  });
}
