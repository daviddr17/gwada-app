import type { MenuCategoryDefinition } from "@/lib/types/menu";
import type { MenuItem } from "@/lib/types/menu";

export type DashboardMenuSummary = {
  dishesTotal: number;
  dishesActive: number;
  categoriesActive: number;
  avgPrice: number | null;
  topCategoryName: string | null;
  topCategoryCount: number;
  withoutCategory: number;
};

export function computeDashboardMenuSummary(
  items: MenuItem[],
  categories: MenuCategoryDefinition[],
): DashboardMenuSummary {
  const activeCategories = categories.filter((c) => c.active !== false);
  const categoryIds = new Set(activeCategories.map((c) => c.id));
  const activeItems = items.filter((i) => i.active !== false);
  const priced = activeItems.filter((i) => Number.isFinite(i.price) && i.price > 0);
  const avgPrice =
    priced.length > 0
      ? priced.reduce((s, i) => s + i.price, 0) / priced.length
      : null;

  const counts = new Map<string, number>();
  let withoutCategory = 0;
  for (const item of activeItems) {
    if (!categoryIds.has(item.category)) {
      withoutCategory += 1;
      continue;
    }
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  }

  let topCategoryName: string | null = null;
  let topCategoryCount = 0;
  for (const cat of activeCategories) {
    const n = counts.get(cat.id) ?? 0;
    if (n > topCategoryCount) {
      topCategoryCount = n;
      topCategoryName = cat.name;
    }
  }

  return {
    dishesTotal: items.length,
    dishesActive: activeItems.length,
    categoriesActive: activeCategories.length,
    avgPrice,
    topCategoryName,
    topCategoryCount,
    withoutCategory,
  };
}
