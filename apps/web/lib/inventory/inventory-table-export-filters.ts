import { compareCategoryThenName } from "@/lib/inventory/sort-by-category";
import { ingredientRowMatchesDishSearch } from "@/lib/menu/recipe-utils";
import type { Ingredient, InventoryTaxonomyDefinition } from "@/lib/types/inventory";
import type { MenuItem } from "@/lib/types/menu";

export const INVENTORY_EXPORT_FILTER_ALL = "all";

export type InventoryTableExportFilters = {
  supplierId: string;
  categoryId: string;
  productionSiteId: string;
  brandId: string;
};

export const DEFAULT_INVENTORY_TABLE_EXPORT_FILTERS: InventoryTableExportFilters =
  {
    supplierId: INVENTORY_EXPORT_FILTER_ALL,
    categoryId: INVENTORY_EXPORT_FILTER_ALL,
    productionSiteId: INVENTORY_EXPORT_FILTER_ALL,
    brandId: INVENTORY_EXPORT_FILTER_ALL,
  };

export function countInventoryTableExportFilters(
  filters: InventoryTableExportFilters,
): number {
  let n = 0;
  if (filters.supplierId !== INVENTORY_EXPORT_FILTER_ALL) n += 1;
  if (filters.categoryId !== INVENTORY_EXPORT_FILTER_ALL) n += 1;
  if (filters.productionSiteId !== INVENTORY_EXPORT_FILTER_ALL) n += 1;
  if (filters.brandId !== INVENTORY_EXPORT_FILTER_ALL) n += 1;
  return n;
}

export function filterIngredientsForTableExport(
  ingredients: Ingredient[],
  filters: InventoryTableExportFilters,
  options?: {
    search?: string;
    menuItems?: MenuItem[];
    categories?: InventoryTaxonomyDefinition[];
  },
): Ingredient[] {
  let rows = [...ingredients];

  if (filters.supplierId !== INVENTORY_EXPORT_FILTER_ALL) {
    rows = rows.filter((r) => r.supplierId === filters.supplierId);
  }
  if (filters.categoryId !== INVENTORY_EXPORT_FILTER_ALL) {
    rows = rows.filter((r) => r.categoryId === filters.categoryId);
  }
  if (filters.productionSiteId !== INVENTORY_EXPORT_FILTER_ALL) {
    rows = rows.filter((r) => r.productionSiteId === filters.productionSiteId);
  }
  if (filters.brandId !== INVENTORY_EXPORT_FILTER_ALL) {
    rows = rows.filter((r) => r.brandId === filters.brandId);
  }

  const q = options?.search?.trim();
  if (q && options?.menuItems) {
    rows = rows.filter((r) =>
      ingredientRowMatchesDishSearch(r.id, r.name, q, options.menuItems!),
    );
  }

  const categories = options?.categories ?? [];
  rows.sort((a, b) =>
    compareCategoryThenName(
      a.categoryId,
      a.name.trim(),
      b.categoryId,
      b.name.trim(),
      categories,
    ),
  );

  return rows;
}
