import type { MenuCategoryDefinition } from "@/lib/types/menu";
import {
  DEMO_MENU_CATEGORY_IDS,
  DEMO_MENU_MAIN_CATEGORY_IDS,
} from "@/lib/constants/demo-menu-uuids";

const C = DEMO_MENU_CATEGORY_IDS;
const M = DEMO_MENU_MAIN_CATEGORY_IDS;

/** Default categories (UUIDs match Postgres seed — `scripts/gen-menu-seed-sql.mjs`). */
export const DEFAULT_CATEGORIES: MenuCategoryDefinition[] = [
  { id: C.starters, name: "Vorspeisen", active: true, mainCategoryId: M.food },
  { id: C.mains, name: "Hauptgerichte", active: true, mainCategoryId: M.food },
  { id: C.sides, name: "Beilagen", active: true, mainCategoryId: M.food },
  { id: C.desserts, name: "Desserts", active: true, mainCategoryId: M.food },
  { id: C.drinks, name: "Getränke", active: true, mainCategoryId: M.beverage },
];

export const CATEGORY_STORAGE_KEY = "gwada-categories-v1";
