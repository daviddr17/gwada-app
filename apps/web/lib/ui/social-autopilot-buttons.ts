import { cn } from "@/lib/utils";
import { brandActionButtonClassName } from "@/lib/ui/brand-action-button";

/**
 * Autopilot: einheitliche Aktionshöhe (h-12 / rounded-xl) —
 * Primär = Brand-Tint, Sekundär = Outline, Ghost = Verwerfen/Abbrechen.
 */

export const autopilotPrimaryButtonClassName = cn(
  brandActionButtonClassName,
  "h-12 w-full gap-2 rounded-xl px-6 tap-scale dark:shadow-sm",
);

export const autopilotSecondaryButtonClassName =
  "h-12 w-full gap-2 rounded-xl border-border/60";

export const autopilotGhostButtonClassName =
  "h-12 w-full gap-2 rounded-xl text-muted-foreground";

/** Kompakt in einer Zeile (z. B. Aufgabe erledigt / verwerfen). */
export const autopilotSecondaryButtonFlexClassName =
  "h-12 flex-1 gap-2 rounded-xl border-border/60";

export const autopilotGhostButtonFlexClassName =
  "h-12 flex-1 gap-2 rounded-xl text-muted-foreground";
