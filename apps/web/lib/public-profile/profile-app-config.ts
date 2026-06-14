import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Images,
  MapPin,
  Newspaper,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import type { ProfileModuleKey } from "@/lib/public-profile/use-profile-module-cache";

export type ProfileAppId = "reserve" | "menu" | "reviews" | "news" | "gallery" | "info";

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
    id: "news",
    label: "News",
    subtitle: "Aktuelles & Posts",
    module: "news",
    icon: Newspaper,
    gradient: "from-rose-500 via-pink-600 to-fuchsia-600",
  },
  {
    id: "gallery",
    label: "Galerie",
    subtitle: "Fotos & Highlights",
    module: "gallery",
    icon: Images,
    gradient: "from-violet-500 via-purple-600 to-indigo-600",
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
    id: "reserve",
    label: "Reservieren",
    subtitle: "Tisch buchen",
    module: "reservation",
    icon: CalendarDays,
    gradient: "from-violet-600 via-fuchsia-600 to-purple-700",
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
  news: boolean;
  gallery: boolean;
}): ProfileAppDefinition[] {
  return PROFILE_APP_DEFINITIONS.filter((app) => {
    if (app.id === "reserve") return modules.reservation;
    if (app.id === "menu") return modules.menu;
    if (app.id === "reviews") return modules.reviews;
    if (app.id === "news") return modules.news;
    if (app.id === "gallery") return modules.gallery;
    return true;
  });
}
