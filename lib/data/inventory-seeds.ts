import type {
  Ingredient,
  InventoryTaxonomyDefinition,
} from "@/lib/types/inventory";

export const SEED_SUPPLIERS: InventoryTaxonomyDefinition[] = [
  { id: "sup-1", name: "Großmarkt Nord", active: true },
  { id: "sup-2", name: "Bio-Lieferant Süd", active: true },
];

export const SEED_INGREDIENT_CATEGORIES: InventoryTaxonomyDefinition[] = [
  { id: "ic-1", name: "Trockenware", active: true },
  { id: "ic-2", name: "Kühlung", active: true },
  { id: "ic-3", name: "Tiefkühl", active: true },
];

export const SEED_PRODUCTION_SITES: InventoryTaxonomyDefinition[] = [
  { id: "ps-1", name: "Hauptküche", active: true },
  { id: "ps-2", name: "Vorbereitung", active: true },
];

export const SEED_BRANDS: InventoryTaxonomyDefinition[] = [
  { id: "br-1", name: "Hausmarke", active: true },
  { id: "br-2", name: "Import", active: true },
];

/** Feste IDs `g` / `l` bleiben mit bestehenden Zutaten kompatibel. */
export const SEED_UNITS: InventoryTaxonomyDefinition[] = [
  { id: "g", name: "Gramm (g)", active: true },
  { id: "l", name: "Liter (l)", active: true },
];

export const SEED_INGREDIENTS: Ingredient[] = [
  {
    id: "ing-1",
    name: "Jasminreis",
    unit: "g",
    currentStock: 5000,
    supplierId: "sup-1",
    categoryId: "ic-1",
    productionSiteId: "ps-1",
    brandId: "br-1",
    active: true,
    stockLog: [],
  },
  {
    id: "ing-2",
    name: "Kokosmilch",
    unit: "l",
    currentStock: 12,
    supplierId: "sup-2",
    categoryId: "ic-2",
    productionSiteId: "ps-1",
    brandId: "br-2",
    active: true,
    stockLog: [],
  },
];
