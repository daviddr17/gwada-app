import type { MenuTaxonomyDefinition } from "@/lib/types/menu";
import {
  DEMO_MENU_ALLERGEN_IDS,
  DEMO_MENU_TAG_IDS,
} from "@/lib/constants/demo-menu-uuids";

export const MENU_TAXONOMY_TAGS_KEY = "gwada-menu-tags-v1";
export const MENU_TAXONOMY_ALLERGENS_KEY = "gwada-menu-allergens-v1";

const T = DEMO_MENU_TAG_IDS;
const A = DEMO_MENU_ALLERGEN_IDS;

/** Diet / kitchen chips — IDs match `menu_tags` seed. */
export const SEED_MENU_TAG_DEFINITIONS: MenuTaxonomyDefinition[] = [
  {
    id: T.vegan,
    name: "Vegan",
    active: true,
    backgroundColor: "#059669",
  },
  {
    id: T.vegetarian,
    name: "Vegetarisch",
    active: true,
    backgroundColor: "#16a34a",
  },
  {
    id: T.spicy,
    name: "Spicy",
    active: true,
    backgroundColor: "#ea580c",
  },
  {
    id: T.halal,
    name: "Halal",
    active: true,
    backgroundColor: "#ca8a04",
  },
];

/** Allergens — IDs match `menu_allergens` seed. */
export const SEED_MENU_ALLERGEN_DEFINITIONS: MenuTaxonomyDefinition[] = [
  {
    id: A.gluten,
    name: "Gluten",
    active: true,
    backgroundColor: "#d97706",
  },
  {
    id: A.nuts,
    name: "Nüsse",
    active: true,
    backgroundColor: "#ca8a04",
  },
  {
    id: A.dairy,
    name: "Milch",
    active: true,
    backgroundColor: "#0284c7",
  },
];
