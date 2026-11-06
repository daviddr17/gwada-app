import {
  SIDEBAR_MODULE_DEFINITIONS,
  type SidebarModuleId,
} from "@/lib/constants/sidebar-modules";
import type { LucideIcon } from "lucide-react";
import { Bot, KeyRound } from "lucide-react";

export type LandingFeatureVisualKey = SidebarModuleId | "assistant" | "api";

export type LandingFeatureItem = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  visual: LandingFeatureVisualKey;
  shortLabel: string;
  comingSoon?: boolean;
};

const MODULE_DESCRIPTIONS: Record<SidebarModuleId, string> = {
  menu: "Gerichte, Kategorien, Allergene und Tageskarten — für Team, Embed und Gäste immer aktuell.",
  inventory:
    "Zutaten, Lieferanten und Bestellungen — Bestände im Blick, verknüpft mit Speisekarte und Einkauf.",
  reservierungen:
    "Tischplan, Slots und Übersicht — klar für Service und Küche, mit öffentlichem Embed.",
  pos: "Native Kasse mit TSE — Coming soon. Online-Bestellung und Kiosk folgen mit dem Add-on.",
  events:
    "Veranstaltungen planen, Gäste und Ablauf — strukturiert im Betriebsalltag.",
  kontakte:
    "WhatsApp, E-Mail, Social und Teamchat — eine Inbox mit Gast-Kontext und CRM-Kontakten.",
  news: "Stories und Social-Posts — manuell oder mit Autopilot aus dem Dashboard auf eure Kanäle.",
  bewertungen:
    "Google und TripAdvisor im Blick — Einladungen senden und Feedback auswerten.",
  insights:
    "Kennzahlen und Plattform-Trends — Reservierungen, Bewertungen und Kanäle auf einen Blick.",
  galerie:
    "Bilder und Medien für Profil, News und Gäste-Auftritt — zentral verwaltet.",
  buchfuehrung:
    "Rechnungen, Angebote und Belege — übersichtlich für Buchhaltung und Team.",
  dokumente:
    "Verträge, HACCP und Team-Dokumente — sicher abgelegt und schnell auffindbar.",
  checklisten:
    "Team-Aufgaben und Eigenkontrolle — abhaken, protokollieren, nichts vergessen.",
  mitarbeiter:
    "Team, Schichtplan, Arbeitszeiten und Verträge — alles an einem Ort.",
};

const MODULE_SHORT_LABELS: Record<SidebarModuleId, string> = {
  menu: "Speisekarte",
  inventory: "Bestand",
  reservierungen: "Reservierungen",
  pos: "POS",
  events: "Events",
  kontakte: "Nachrichten",
  news: "News",
  bewertungen: "Bewertungen",
  insights: "Insights",
  galerie: "Galerie",
  buchfuehrung: "Buchführung",
  dokumente: "Dokumente",
  checklisten: "Aufgaben",
  mitarbeiter: "Team",
};

const MODULE_ACCENTS: Record<SidebarModuleId, string> = {
  menu: "from-violet-500/20 via-fuchsia-500/10 to-transparent",
  inventory: "from-amber-500/20 via-orange-500/10 to-transparent",
  reservierungen: "from-sky-500/20 via-blue-500/10 to-transparent",
  pos: "from-orange-500/20 via-amber-500/10 to-transparent",
  events: "from-pink-500/20 via-rose-500/10 to-transparent",
  kontakte: "from-emerald-500/20 via-teal-500/10 to-transparent",
  news: "from-indigo-500/20 via-violet-500/10 to-transparent",
  bewertungen: "from-yellow-500/20 via-amber-500/10 to-transparent",
  insights: "from-violet-500/20 via-purple-500/10 to-transparent",
  galerie: "from-cyan-500/20 via-sky-500/10 to-transparent",
  buchfuehrung: "from-lime-500/20 via-green-500/10 to-transparent",
  dokumente: "from-slate-500/20 via-zinc-500/10 to-transparent",
  checklisten: "from-teal-500/20 via-emerald-500/10 to-transparent",
  mitarbeiter: "from-blue-500/20 via-indigo-500/10 to-transparent",
};

const COMING_SOON_MODULE_IDS = new Set<SidebarModuleId>(["pos"]);

const MODULE_ITEMS: LandingFeatureItem[] = SIDEBAR_MODULE_DEFINITIONS.map(
  (def) => ({
    id: def.id,
    title: def.label,
    description: MODULE_DESCRIPTIONS[def.id],
    icon: def.icon,
    accent: MODULE_ACCENTS[def.id],
    visual: def.id,
    shortLabel: MODULE_SHORT_LABELS[def.id],
    comingSoon: COMING_SOON_MODULE_IDS.has(def.id),
  }),
);

/** Cross-cutting Product-Features außerhalb der Sidebar-Module. */
const EXTRA_FEATURE_ITEMS: LandingFeatureItem[] = [
  {
    id: "assistant",
    title: "KI-Assistent",
    description:
      "Im Dashboard helfen — Reservierungen, Speisekarte und Betrieb per Chat steuern, ohne Modul-Hopping.",
    icon: Bot,
    accent: "from-fuchsia-500/20 via-violet-500/10 to-transparent",
    visual: "assistant",
    shortLabel: "Assistent",
  },
  {
    id: "api",
    title: "API & MCP",
    description:
      "Öffentliche Restaurant-API und MCP — eigene Tools und Automationen mit denselben Rechten wie in der App.",
    icon: KeyRound,
    accent: "from-slate-500/20 via-sky-500/10 to-transparent",
    visual: "api",
    shortLabel: "API",
  },
];

/** Scroll-Story: Sidebar-Module (App-Reihenfolge) plus Assistent und API/MCP. */
export const LANDING_FEATURE_ITEMS: LandingFeatureItem[] = [
  ...MODULE_ITEMS,
  ...EXTRA_FEATURE_ITEMS,
];
