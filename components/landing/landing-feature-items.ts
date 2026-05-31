import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  LayoutGrid,
  Palette,
  QrCode,
  ShieldCheck,
  UtensilsCrossed,
} from "lucide-react";

export type LandingFeatureItem = {
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
};

export const LANDING_FEATURE_ITEMS: LandingFeatureItem[] = [
  {
    title: "Digitale Speisekarte",
    description:
      "Strukturierte Gerichte, Allergene und schöne Karten — schnell editierbar für dein Team.",
    icon: UtensilsCrossed,
    accent: "from-violet-500/20 via-fuchsia-500/10 to-transparent",
  },
  {
    title: "Reservierungen",
    description:
      "Tischplan, Slots und Übersicht — ohne visuelles Rauschen, klar für Service und Küche.",
    icon: CalendarDays,
    accent: "from-sky-500/20 via-blue-500/10 to-transparent",
  },
  {
    title: "Branding & Akzent",
    description:
      "Farben und Typo passend zum Restaurant — konsistent auf Dashboard, Karte und Gäste-Flow.",
    icon: Palette,
    accent: "from-amber-500/20 via-orange-500/10 to-transparent",
  },
  {
    title: "QR & Gast-Flow",
    description:
      "Gäste scannen, lesen, reservieren — linear und vertraut, ohne App-Download.",
    icon: QrCode,
    accent: "from-emerald-500/20 via-teal-500/10 to-transparent",
  },
  {
    title: "Mandantenfähig",
    description:
      "Workspace, Rollen und Team — sauber getrennt, skalierbar für mehrere Standorte.",
    icon: LayoutGrid,
    accent: "from-indigo-500/20 via-violet-500/10 to-transparent",
  },
  {
    title: "Zuverlässigkeit",
    description:
      "Klare Fehlerbilder, robuste Syncs — weniger Support, mehr Vertrauen im Betrieb.",
    icon: ShieldCheck,
    accent: "from-rose-500/20 via-pink-500/10 to-transparent",
  },
];
