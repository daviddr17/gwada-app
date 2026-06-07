import { cn } from "@/lib/utils";

/**
 * SelectTrigger: Fokus / geöffnet mit Ring + Border wie Tabellen-Selects (Bestand).
 * Mit `cn(..., "h-9 w-full …")` an Breite/Höhe anpassen.
 */
export const appSelectTriggerAccentClassName =
  "border border-input bg-transparent shadow-none transition-[border-color,box-shadow] outline-none hover:border-border focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/45 data-popup-open:border-ring data-popup-open:ring-[3px] data-popup-open:ring-ring/45";

export function appSelectTriggerAccentCn(...parts: (string | false | null | undefined)[]) {
  return cn(appSelectTriggerAccentClassName, ...parts);
}
