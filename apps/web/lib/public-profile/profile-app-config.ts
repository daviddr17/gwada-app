import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  MapPin,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import type { ProfileModuleKey } from "@/lib/public-profile/use-profile-module-cache";

export type ProfileAppId = "reserve" | "menu" | "reviews" | "info";

export type ProfileAppDefinition = {
  id: ProfileAppId;
  label: string;
  subtitle: string;
  module?: ProfileModuleKey;
  icon: LucideIcon;
  /** Tailwind gradient stops for icon tile */
  gradient: string;
};

export const PROFILE_APP_DEFINITIONS: ProfileAppDefinition[] = [
  {
    id: "reserve",
    label: "Reservieren",
    subtitle: "Tisch buchen",
    module: "reservation",
    icon: CalendarDays,
    gradient: "from-violet-600 via-fuchsia-600 to-purple-700",
  },
  {
    id: "menu",
    label: "Speisekarte",
    subtitle: "Gerichte & Preise",
    module: "menu",
    icon: UtensilsCrossed,
    gradient: "from-orange-500 via-amber-500 to-orange-600",
  },
  {
    id: "reviews",
    label: "Bewertungen",
    subtitle: "Stimmen der Gäste",
    module: "reviews",
    icon: Star,
    gradient: "from-sky-500 via-blue-600 to-indigo-600",
  },
  {
    id: "info",
    label: "Info",
    subtitle: "Kontakt & Zeiten",
    icon: MapPin,
    gradient: "from-emerald-500 via-teal-600 to-cyan-700",
  },
];

export function profileAppsForModules(modules: {
  reservation: boolean;
  menu: boolean;
  reviews: boolean;
}): ProfileAppDefinition[] {
  return PROFILE_APP_DEFINITIONS.filter((app) => {
    if (app.id === "reserve") return modules.reservation;
    if (app.id === "menu") return modules.menu;
    if (app.id === "reviews") return modules.reviews;
    return true;
  });
}
