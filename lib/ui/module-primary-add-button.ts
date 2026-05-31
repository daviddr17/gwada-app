import { cn } from "@/lib/utils";

/**
 * Primäre „Neu anlegen“-Aktion über Listen/Tabellen (Speisekarte, Bestand, Dokumente, …).
 * Immer `size="lg"`, rechts (`flex justify-end`), mit Plus-Icon.
 */
export const modulePrimaryAddButtonClassName = cn(
  "h-12 gap-2 rounded-full bg-accent px-6 text-accent-foreground shadow-none tap-scale hover:bg-accent/90 dark:shadow-md",
);
