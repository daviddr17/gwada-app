import type { MenuCategoryDefinition } from "@/lib/types/menu";

/** Default-Kategorien (stabile IDs für Mock-Daten & Migration). */
export const DEFAULT_CATEGORIES: MenuCategoryDefinition[] = [
  { id: "starters", name: "Vorspeisen", active: true },
  { id: "mains", name: "Hauptgerichte", active: true },
  { id: "sides", name: "Beilagen", active: true },
  { id: "desserts", name: "Desserts", active: true },
  { id: "drinks", name: "Getränke", active: true },
];

export const CATEGORY_STORAGE_KEY = "gwada-categories-v1";
