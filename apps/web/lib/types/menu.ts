/** Stammdaten: Eigenschaft oder Allergen (Chip inkl. Farbe). */
export type MenuTaxonomyDefinition = {
  id: string;
  name: string;
  active?: boolean;
  /** Anzeige-Hintergrund für Chips (#rrggbb) */
  backgroundColor: string;
};

/** Tag-/Allergen-ID aus den Stammdaten (frei wählbar bei neuen Einträgen). */
export type MenuTag = string;

/** Kategorie-ID (Standard-IDs wie `starters` oder UUID für neue). */
export type MenuCategoryId = string;

export interface MenuCategoryDefinition {
  id: MenuCategoryId;
  name: string;
  /** false = in der Karte ausgeblendet (Redaktion). Standard: aktiv. */
  active?: boolean;
}

export type MenuRecipeLine = {
  /** Referenz auf Zutat im Bestand (`Ingredient.id`) */
  ingredientId: string;
  /** Menge in der Lagereinheit der gewählten Zutat (siehe Bestand) */
  amount: number;
};

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: MenuCategoryId;
  imageUrl: string;
  tags: MenuTag[];
  /** false = nicht aktiv; in der Übersicht gekennzeichnet. Standard: aktiv. */
  active?: boolean;
  /** Optionale Anzeige-Nummer (Sortierung innerhalb der Kategorie). */
  listNumber?: number | null;
  /** Optional: Rezept aus Bestandszutaten mit Mengen */
  recipe?: MenuRecipeLine[] | null;
}

export type NewMenuItem = Omit<MenuItem, "id">;

export type DietFilter = MenuTag | "all";

export type PriceRange = [number, number];
