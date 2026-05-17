import type { MenuCategoryDefinition } from "@/lib/types/menu";
import { DEMO_MENU_CATEGORY_IDS } from "@/lib/constants/demo-menu-uuids";

const C = DEMO_MENU_CATEGORY_IDS;

/** Default categories (UUIDs match Postgres seed — `scripts/gen-menu-seed-sql.mjs`). */
export const DEFAULT_CATEGORIES: MenuCategoryDefinition[] = [
  { id: C.starters, name: "Vorspeisen", active: true },
  { id: C.mains, name: "Hauptgerichte", active: true },
  { id: C.sides, name: "Beilagen", active: true },
  { id: C.desserts, name: "Desserts", active: true },
  { id: C.drinks, name: "Getränke", active: true },
];

export const CATEGORY_STORAGE_KEY = "gwada-categories-v1";
