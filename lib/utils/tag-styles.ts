import type { MenuTag } from "@/lib/types/menu";

/** Subtle tag chips – works in light & dark (iOS-style). */
export function getTagBadgeClass(tag: MenuTag): string {
  const map: Record<MenuTag, string> = {
    vegan: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    vegetarian:
      "border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300",
    spicy: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
    gluten: "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200",
    nuts: "border-yellow-600/25 bg-yellow-500/10 text-yellow-800 dark:text-yellow-200",
    dairy: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    halal: "border-accent/30 bg-accent/10 text-foreground",
  };
  return map[tag];
}
