import { cn } from "@/lib/utils";
import {
  drawerFormSectionBleedClasses,
  type DrawerContentPadding,
  type DrawerFormSectionBleed,
} from "@/lib/ui/drawer-form-section";

/**
 * Filter-Bottom-Sheets: klare Zonen statt vieler gleicher grauer Bänder.
 * Filter = kühler Neutral-Tint, Sortierung = warmer Akzent-Tint.
 */

export const drawerFilterZoneClassName =
  "space-y-4 rounded-2xl border border-border/50 bg-muted/25 p-4";

export const drawerSortZoneClassName =
  "space-y-4 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4";

export const drawerFilterZoneLabelClassName =
  "text-xs font-semibold tracking-wide text-muted-foreground uppercase";

export const drawerSortZoneLabelClassName =
  "text-xs font-semibold tracking-wide text-amber-800/80 uppercase dark:text-amber-200/90";

/** Kurz-Label über einem Feld (Schlagwort, keine Beschreibung). */
export const drawerFilterFieldLabelClassName =
  "text-sm font-medium text-foreground";

export const drawerFilterFieldGroupClassName = "space-y-2";

/** Switch-/Checkbox-Zeile ohne Hilfstext darunter. */
export const drawerFilterSwitchRowClassName =
  "flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-background/60 px-4 py-3";

export function drawerFilterZoneShellClassName(
  contentPadding: DrawerContentPadding = 6,
  bleed: DrawerFormSectionBleed = true,
  className?: string,
): string {
  return cn(
    drawerFormSectionBleedClasses(contentPadding, bleed),
    "py-3 first:pt-1",
    className,
  );
}

export const drawerFilterHeaderTitleClassName =
  "text-xl font-semibold tracking-tight";
