import type { DietFilter, MenuTag } from "@/lib/types/menu";

export const TAG_LABELS: Record<MenuTag, string> = {
  vegan: "Vegan",
  vegetarian: "Vegetarisch",
  spicy: "Spicy",
  gluten: "Gluten",
  nuts: "Nüsse",
  dairy: "Milch",
  halal: "Halal",
};

export const DIET_FILTERS: { value: DietFilter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "vegan", label: "Vegan" },
  { value: "vegetarian", label: "Vegetarisch" },
  { value: "spicy", label: "Spicy" },
  { value: "gluten", label: "Gluten" },
  { value: "nuts", label: "Nüsse" },
];

export const ALL_TAGS: MenuTag[] = [
  "vegan",
  "vegetarian",
  "spicy",
  "gluten",
  "nuts",
  "dairy",
  "halal",
];
