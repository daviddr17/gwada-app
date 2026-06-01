import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Contact,
  FileText,
  Package,
  Users,
  UtensilsCrossed,
} from "lucide-react";

/** Hauptmodule der App-Sidebar (Restaurant-Betrieb). */
export const LANDING_APP_MODULES: readonly {
  label: string;
  icon: LucideIcon;
}[] = [
  { label: "Speisekarte", icon: UtensilsCrossed },
  { label: "Bestand", icon: Package },
  { label: "Reservierungen", icon: CalendarDays },
  { label: "Kontakte", icon: Contact },
  { label: "Dokumente", icon: FileText },
  { label: "Mitarbeiter", icon: Users },
];
