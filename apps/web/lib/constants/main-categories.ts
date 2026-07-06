import type { MenuMainCategoryDefinition } from "@/lib/types/menu";
import { DEMO_MENU_MAIN_CATEGORY_IDS } from "@/lib/constants/demo-menu-uuids";

/** Default Hauptkategorien pro Restaurant (Speisen + Getränke). */
export const DEFAULT_MAIN_CATEGORIES: MenuMainCategoryDefinition[] = [
  { id: DEMO_MENU_MAIN_CATEGORY_IDS.food, name: "Speisen", active: true },
  { id: DEMO_MENU_MAIN_CATEGORY_IDS.beverage, name: "Getränke", active: true },
];

export const MAIN_CATEGORY_STORAGE_KEY = "gwada-main-categories-v1";
