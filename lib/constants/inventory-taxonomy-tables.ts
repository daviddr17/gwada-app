import {
  INVENTORY_BRANDS_KEY,
  INVENTORY_INGREDIENT_CATEGORIES_KEY,
  INVENTORY_PRODUCTION_SITES_KEY,
  INVENTORY_SUPPLIERS_KEY,
  INVENTORY_UNITS_KEY,
} from "@/lib/constants/inventory-storage";

export const INVENTORY_TAXONOMY_TABLE_BY_KEY = {
  [INVENTORY_SUPPLIERS_KEY]: "inventory_suppliers",
  [INVENTORY_BRANDS_KEY]: "inventory_brands",
  [INVENTORY_INGREDIENT_CATEGORIES_KEY]: "inventory_ingredient_categories",
  [INVENTORY_PRODUCTION_SITES_KEY]: "inventory_production_sites",
  [INVENTORY_UNITS_KEY]: "inventory_units",
} as const;

export type InventoryTaxonomyDbTable =
  (typeof INVENTORY_TAXONOMY_TABLE_BY_KEY)[keyof typeof INVENTORY_TAXONOMY_TABLE_BY_KEY];

export function inventoryTaxonomyTableForStorageKey(
  storageKey: string,
): InventoryTaxonomyDbTable | null {
  const t =
    INVENTORY_TAXONOMY_TABLE_BY_KEY[
      storageKey as keyof typeof INVENTORY_TAXONOMY_TABLE_BY_KEY
    ];
  return t ?? null;
}
