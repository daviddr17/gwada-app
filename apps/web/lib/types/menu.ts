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

/** Hauptkategorie-ID (Speisen, Getränke, …). */
export type MenuMainCategoryId = string;

export interface MenuMainCategoryDefinition {
  id: MenuMainCategoryId;
  name: string;
  /** false = in der Leiste ausgeblendet. Standard: aktiv. */
  active?: boolean;
}

export interface MenuCategoryDefinition {
  id: MenuCategoryId;
  name: string;
  /** Zugehörige Hauptkategorie (Speisen / Getränke / …). */
  mainCategoryId?: MenuMainCategoryId;
  /** false = in der Karte ausgeblendet (Redaktion). Standard: aktiv. */
  active?: boolean;
}

export type MenuRecipeLine = {
  /** Referenz auf Zutat im Bestand (`Ingredient.id`) */
  ingredientId: string;
  /** Menge in der Lagereinheit der gewählten Zutat (siehe Bestand) */
  amount: number;
};

/** Eine wählbare Position in einer Optionsgruppe (z. B. Pommes). */
export type MenuOptionChoice = {
  id: string;
  name: string;
  /** Aufpreis in €; 0 = kein Aufpreis */
  priceDelta: number;
  active?: boolean;
};

/**
 * Wiederverwendbare Optionsgruppe (z. B. „Beilagen“, „Extras“).
 * Kann mehreren Gerichten zugeordnet werden.
 */
export type MenuOptionGroup = {
  id: string;
  name: string;
  active?: boolean;
  /** 0 = optional; >=1 = mindestens so viele Choices */
  minSelect: number;
  /** null = beliebig viele */
  maxSelect: number | null;
  choices: MenuOptionChoice[];
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
  /** Zugeordnete Optionsgruppen (IDs), Reihenfolge = Anzeige */
  optionGroupIds?: string[];
  /** Optional: Anzeige ab (YYYY-MM-DD, inklusive). */
  availableFrom?: string | null;
  /** Optional: Anzeige bis (YYYY-MM-DD, inklusive). */
  availableTo?: string | null;
}

export type NewMenuItem = Omit<MenuItem, "id">;

export type DietFilter = MenuTag | "all";

export type PriceRange = [number, number];
