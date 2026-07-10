import {
  SIDEBAR_MODULE_DEFINITIONS,
  type SidebarModuleId,
} from "@/lib/constants/sidebar-modules";
import type { LucideIcon } from "lucide-react";

export type LandingFeatureVisualKey = SidebarModuleId;

export type LandingFeatureItem = {
  id: SidebarModuleId;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  visual: LandingFeatureVisualKey;
};

const MODULE_DESCRIPTIONS: Record<SidebarModuleId, string> = {
  menu: "Gerichte, Kategorien, Allergene und Tageskarten — für Team und Gäste immer aktuell.",
  inventory:
    "Zutaten, Lieferanten und Bestände im Blick — verknüpft mit Speisekarte und Einkauf.",
  reservierungen:
    "Tischplan, Slots und Übersicht — klar für Service und Küche, ohne visuelles Rauschen.",
  events:
    "Veranstaltungen planen, Gäste und Ablauf — strukturiert im Betriebsalltag.",
  kontakte:
    "WhatsApp, E-Mail und Social — alle Kanäle zentral beantworten, mit Gast-Kontext.",
  news: "Stories und Updates für Gäste — aus dem Dashboard auf eure Kanäle bringen.",
  bewertungen:
    "Google und weitere Plattformen im Blick — Einladungen senden und Feedback auswerten.",
  galerie:
    "Bilder und Medien für Profil, News und Gäste-Auftritt — zentral verwaltet.",
  buchfuehrung:
    "Rechnungen, Angebote und Belege — übersichtlich für Buchhaltung und Team.",
  dokumente:
    "Verträge, HACCP und Team-Dokumente — sicher abgelegt und schnell auffindbar.",
  checklisten:
    "HACCP und Tagesaufgaben — abhaken, protokollieren, nichts vergessen.",
  mitarbeiter:
    "Team, Schichtplan, Verträge und Einladungen — alles an einem Ort.",
};

const MODULE_ACCENTS: Record<SidebarModuleId, string> = {
  menu: "from-violet-500/20 via-fuchsia-500/10 to-transparent",
  inventory: "from-amber-500/20 via-orange-500/10 to-transparent",
  reservierungen: "from-sky-500/20 via-blue-500/10 to-transparent",
  events: "from-pink-500/20 via-rose-500/10 to-transparent",
  kontakte: "from-emerald-500/20 via-teal-500/10 to-transparent",
  news: "from-indigo-500/20 via-violet-500/10 to-transparent",
  bewertungen: "from-yellow-500/20 via-amber-500/10 to-transparent",
  galerie: "from-cyan-500/20 via-sky-500/10 to-transparent",
  buchfuehrung: "from-lime-500/20 via-green-500/10 to-transparent",
  dokumente: "from-slate-500/20 via-zinc-500/10 to-transparent",
  checklisten: "from-teal-500/20 via-emerald-500/10 to-transparent",
  mitarbeiter: "from-blue-500/20 via-indigo-500/10 to-transparent",
};

/** Scroll-Story: ein Slide pro Sidebar-Modul (Reihenfolge wie in der App). */
export const LANDING_FEATURE_ITEMS: LandingFeatureItem[] =
  SIDEBAR_MODULE_DEFINITIONS.map((def) => ({
    id: def.id,
    title: def.label,
    description: MODULE_DESCRIPTIONS[def.id],
    icon: def.icon,
    accent: MODULE_ACCENTS[def.id],
    visual: def.id,
  }));
