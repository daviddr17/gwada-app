import {
  BILLING_ADDONS,
  BILLING_PLAN_IDS,
  BILLING_PLANS,
  SIDEBAR_MODULE_BILLING_FEATURE,
  isBillingAddonPurchasable,
  planHasFeature,
  type BillingAddonId,
  type BillingPlanId,
} from "@/lib/billing/plan-catalog";
import {
  SIDEBAR_MODULE_BY_ID,
  type SidebarModuleId,
} from "@/lib/constants/sidebar-modules";
import type { LucideIcon } from "lucide-react";

export type SidebarModuleUnlock =
  | { kind: "plan"; planId: Exclude<BillingPlanId, "free"> }
  | { kind: "addon"; addonId: BillingAddonId };

/** Eine Zeile: was das Modul im Abo freischaltet. */
const MODULE_UPSELL_DESCRIPTION: Partial<Record<SidebarModuleId, string>> = {
  inventory:
    "Zutaten, Lieferanten und Bestände im Blick — verknüpft mit Speisekarte und Einkauf.",
  news: "Stories und Updates für Gäste — aus dem Dashboard auf eure Kanäle bringen.",
  events:
    "Veranstaltungen planen, Gäste und Ablauf — strukturiert im Betriebsalltag.",
  galerie:
    "Bilder und Medien für Profil, News und Gäste-Auftritt — zentral verwaltet.",
  bewertungen:
    "Google und weitere Plattformen im Blick — Einladungen senden und Feedback auswerten.",
  kontakte:
    "WhatsApp, E-Mail und Social — alle Kanäle zentral beantworten, mit Gast-Kontext.",
  dokumente:
    "Verträge, HACCP und Team-Dokumente — sicher abgelegt und schnell auffindbar.",
  checklisten:
    "HACCP und Tagesaufgaben — abhaken, protokollieren, nichts vergessen.",
  mitarbeiter:
    "Team, Schichtplan, Verträge und Einladungen — alles an einem Ort.",
  buchfuehrung:
    "Rechnungen, Angebote und Belege — übersichtlich für Buchhaltung und Team.",
  insights:
    "Kennzahlen und Plattform-Status — Reservierungen, Bewertungen und Nachrichten auf einen Blick.",
  pos: "Native Kasse mit TSE — Coming soon. Noch nicht im Abo zubuchbar.",
};

/** Kurz-Highlights für die Upsell-Erklärung. */
const MODULE_UPSELL_BULLETS: Partial<
  Record<SidebarModuleId, readonly string[]>
> = {
  inventory: [
    "Zutaten, Lieferanten und Bestände",
    "Verknüpft mit Speisekarte & Einkauf",
    "Nichts läuft ins Leere",
  ],
  news: [
    "Stories & Updates für Gäste",
    "Direkt aus dem Dashboard posten",
    "Kanalübergreifend sichtbar",
  ],
  events: [
    "Veranstaltungen planen",
    "Ablauf und Gäste im Blick",
    "Im Betriebsalltag verankert",
  ],
  galerie: [
    "Bilder zentral pflegen",
    "Für Profil, News und Auftritt",
    "Immer das richtige Motiv",
  ],
  bewertungen: [
    "Google & Co. im Überblick",
    "Einladungen senden",
    "Feedback auswerten",
  ],
  kontakte: [
    "WhatsApp, E-Mail und Social",
    "Eine Inbox mit Gast-Kontext",
    "Schneller antworten",
  ],
  dokumente: [
    "Verträge & Team-Dokumente",
    "Sicher abgelegt",
    "Sofort auffindbar",
  ],
  checklisten: [
    "HACCP und Tagesaufgaben",
    "Abhaken & protokollieren",
    "Nichts vergessen",
  ],
  mitarbeiter: [
    "Schichtplan & Zeiterfassung",
    "Verträge und Einladungen",
    "Unbegrenzte Nutzer",
  ],
  buchfuehrung: [
    "Rechnungen & Belege",
    "Angebote im Blick",
    "Klar für Buchhaltung",
  ],
  insights: [
    "Kennzahlen auf einen Blick",
    "Reservierungen, Bewertungen, Inbox",
    "Kanalübergreifender Status",
  ],
  pos: [
    "Kasse mit TSE",
    "Quittungen & Berichte",
    "Coming soon — noch nicht zubuchbar",
  ],
};

export function requiredUnlockForSidebarModule(
  moduleId: SidebarModuleId,
): SidebarModuleUnlock | null {
  const feature = SIDEBAR_MODULE_BILLING_FEATURE[moduleId];
  if (!feature) return null;
  if (feature === BILLING_ADDONS.pos.feature) {
    return { kind: "addon", addonId: "pos" };
  }
  for (const planId of BILLING_PLAN_IDS) {
    if (!planHasFeature(planId, feature)) continue;
    if (planId === "free") return null;
    return { kind: "plan", planId };
  }
  return { kind: "plan", planId: "pro" };
}

export function unlockLabel(unlock: SidebarModuleUnlock): string {
  if (unlock.kind === "addon") {
    const addon = BILLING_ADDONS[unlock.addonId];
    if (addon.comingSoon) return "Coming soon";
    return `${addon.name}-Add-on`;
  }
  return BILLING_PLANS[unlock.planId].name;
}

export function unlockCtaLabel(unlock: SidebarModuleUnlock): string {
  if (unlock.kind === "addon") {
    if (!isBillingAddonPurchasable(unlock.addonId)) return "Bald verfügbar";
    return "POS zubuchen";
  }
  return `${BILLING_PLANS[unlock.planId].name} ansehen`;
}

export type SidebarModuleUpsellContent = {
  moduleId: SidebarModuleId;
  title: string;
  description: string;
  bullets: readonly string[];
  icon: LucideIcon;
  unlock: SidebarModuleUnlock;
  unlockBadge: string;
  ctaLabel: string;
  ctaDisabled?: boolean;
};

export function sidebarModuleUpsellContent(
  moduleId: SidebarModuleId,
): SidebarModuleUpsellContent | null {
  const unlock = requiredUnlockForSidebarModule(moduleId);
  if (!unlock) return null;

  const def = SIDEBAR_MODULE_BY_ID.get(moduleId);
  const description = MODULE_UPSELL_DESCRIPTION[moduleId];
  if (!def || !description) return null;

  return {
    moduleId,
    title: def.label,
    description,
    bullets: MODULE_UPSELL_BULLETS[moduleId] ?? [],
    icon: def.icon,
    unlock,
    unlockBadge: unlockLabel(unlock),
    ctaLabel: unlockCtaLabel(unlock),
    ctaDisabled:
      unlock.kind === "addon" && !isBillingAddonPurchasable(unlock.addonId),
  };
}
