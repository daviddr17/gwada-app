import { cn } from "@/lib/utils";
import {
  brandActionButtonClassName,
  brandActionButtonPillClassName,
} from "@/lib/ui/brand-action-button";

/** Primäre „Neu anlegen“-Aktion (kompakt, z. B. neben anderen Buttons). */
export const modulePrimaryAddButtonClassName = brandActionButtonPillClassName;

/**
 * Primäre „Neu anlegen“-Aktion **über Listen/Tabellen — volle Breite**
 * (Schichtplan, Mitarbeiter, Bestand, Speisekarte, …).
 * Mit `Button size="lg"` und `Plus`-Icon (oder passendem Icon).
 */
export const modulePrimaryAddButtonFullWidthClassName = cn(
  brandActionButtonClassName,
  "h-12 w-full gap-2 rounded-xl px-6 tap-scale dark:shadow-sm",
);
