import type { UserGuidePage } from "@/lib/docs/user-guide-content";
import {
  bewertungenGuide,
  galerieGuide,
  insightsGuide,
} from "@/lib/docs/handbuch/bewertungen-insights-galerie";
import { bestandGuide } from "@/lib/docs/handbuch/bestand";
import {
  buchfuehrungGuide,
  dokumenteGuide,
} from "@/lib/docs/handbuch/buchfuehrung-dokumente";
import {
  checklistenGuide,
  mitarbeiterGuide,
} from "@/lib/docs/handbuch/checklisten-mitarbeiter";
import { dashboardGuide } from "@/lib/docs/handbuch/dashboard";
import {
  displayGuide,
  einstellungenGuide,
  integrationenGuide,
  oeffentlichesProfilGuide,
  profilGuide,
} from "@/lib/docs/handbuch/einstellungen-rest";
import {
  eventsGuide,
  nachrichtenGuide,
  newsGuide,
} from "@/lib/docs/handbuch/nachrichten-events-news";
import { reservierungenGuide } from "@/lib/docs/handbuch/reservierungen";
import { speisekarteGuide } from "@/lib/docs/handbuch/speisekarte";

export const USER_GUIDE_PAGES: UserGuidePage[] = [
  dashboardGuide,
  speisekarteGuide,
  bestandGuide,
  reservierungenGuide,
  eventsGuide,
  nachrichtenGuide,
  newsGuide,
  bewertungenGuide,
  insightsGuide,
  galerieGuide,
  buchfuehrungGuide,
  dokumenteGuide,
  checklistenGuide,
  mitarbeiterGuide,
  einstellungenGuide,
  integrationenGuide,
  displayGuide,
  oeffentlichesProfilGuide,
  profilGuide,
];

export const USER_GUIDE_BY_SLUG = new Map(
  USER_GUIDE_PAGES.map((page) => [page.slug, page] as const),
);

export function userGuideSlugs(): string[] {
  return USER_GUIDE_PAGES.map((page) => page.slug);
}

export function userGuideBySlug(slug: string): UserGuidePage | undefined {
  return USER_GUIDE_BY_SLUG.get(slug);
}
