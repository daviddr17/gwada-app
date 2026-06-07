import type { IngredientStockLogEntry } from "@/lib/types/ingredient-stock-log";

/** Wie Speisekarten-Kategorien: id, Name, optional aktiv. */
export type InventoryTaxonomyDefinition = {
  id: string;
  name: string;
  active?: boolean;
};

/** ID einer Lagereinheit (z. B. `g`, `l` oder eigene Einträge). */
export type IngredientStockUnit = string;

export type Ingredient = {
  id: string;
  name: string;
  /** Mengeneinheit für den Lagerbestand (Referenz auf Lagereinheiten) */
  unit: IngredientStockUnit;
  /** Aktueller Bestand (numerisch, Bedeutung gemäß gewählter Lagereinheit) */
  currentStock: number;
  supplierId: string;
  categoryId: string;
  productionSiteId: string;
  brandId: string;
  active?: boolean;
  /** Bestandsprotokoll (lokal), gleiche Idee wie Bestellprotokoll */
  stockLog: IngredientStockLogEntry[];
};

export type NewIngredient = Omit<Ingredient, "id" | "stockLog"> & {
  stockLog?: IngredientStockLogEntry[];
};
