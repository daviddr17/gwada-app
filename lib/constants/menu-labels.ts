import type { DietFilter, MenuTaxonomyDefinition } from "@/lib/types/menu";

/** Fallback-Labels für ältere Daten ohne Stammdaten-Treffer. */
export const FALLBACK_TAG_LABELS: Record<string, string> = {
  vegan: "Vegan",
  vegetarian: "Vegetarisch",
  spicy: "Spicy",
  gluten: "Gluten",
  nuts: "Nüsse",
  dairy: "Milch",
  halal: "Halal",
};

export function labelForTagId(
  id: string,
  definitions: readonly MenuTaxonomyDefinition[],
): string {
  const def = definitions.find((d) => d.id === id);
  if (def) return def.name;
  return FALLBACK_TAG_LABELS[id] ?? id;
}

export function buildDietFilterOptions(
  definitions: readonly MenuTaxonomyDefinition[],
): { value: DietFilter; label: string }[] {
  const active = definitions.filter((d) => d.active !== false);
  return [
    { value: "all", label: "Alle" },
    ...active.map((d) => ({ value: d.id as DietFilter, label: d.name })),
  ];
}
