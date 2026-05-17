import type { CSSProperties } from "react";
import type { MenuTaxonomyDefinition } from "@/lib/types/menu";

const LEGACY_BADGE: Record<string, string> = {
  vegan:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  vegetarian:
    "border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300",
  spicy:
    "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  gluten: "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  nuts: "border-yellow-600/25 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200",
  dairy: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  halal: "border-accent/30 bg-accent/10 text-foreground",
};

const HEX = /^#[0-9A-Fa-f]{6}$/;

export type TagChipVisual = {
  className: string;
  style?: CSSProperties;
};

/** Chip-Darstellung aus Stammdaten-Farbe oder Legacy-Tailwind. */
export function getTagChipVisual(
  tagId: string,
  definitions: readonly MenuTaxonomyDefinition[],
): TagChipVisual {
  const def = definitions.find((d) => d.id === tagId);
  if (def && HEX.test(def.backgroundColor)) {
    const bg = def.backgroundColor;
    return {
      className:
        "border font-medium shadow-none text-foreground dark:text-foreground",
      style: {
        backgroundColor: `color-mix(in srgb, ${bg} 22%, transparent)`,
        borderColor: `color-mix(in srgb, ${bg} 42%, transparent)`,
      },
    };
  }
  return {
    className:
      LEGACY_BADGE[tagId] ??
      "border-border/40 bg-muted/45 text-foreground dark:bg-muted/35",
  };
}
