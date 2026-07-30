import { APP_ROUTES } from "@/lib/navigation/app-routes";
import type { DashboardGlobalSearchCategory } from "@/lib/types/dashboard-global-search";

export const DASHBOARD_GLOBAL_SEARCH_CATEGORY_LABELS: Record<
  DashboardGlobalSearchCategory,
  string
> = {
  menu: "Speisekarte",
  reservations: "Reservierungen",
  contacts: "Kontakte",
  reviews: "Bewertungen",
  staff: "Mitarbeiter",
  inventory: "Bestand",
  documents: "Dokumente",
  news: "News",
  events: "Events",
  accounting: "Buchführung",
  gallery: "Galerie",
  staff_todos: "ToDo-Listen",
};

export const DASHBOARD_GLOBAL_SEARCH_CATEGORY_ORDER: DashboardGlobalSearchCategory[] =
  [
    "menu",
    "reservations",
    "contacts",
    "reviews",
    "staff",
    "inventory",
    "documents",
    "news",
    "events",
    "accounting",
    "gallery",
    "staff_todos",
  ];

/** Modul-Übersicht ohne konkreten Eintrag (Sheet: „Zum Modul“). */
export function dashboardGlobalSearchModuleHref(
  category: DashboardGlobalSearchCategory,
): string {
  switch (category) {
    case "menu":
      return APP_ROUTES.menu.overview;
    case "reservations":
      return APP_ROUTES.reservierungen.overview;
    case "contacts":
      return APP_ROUTES.kontakte.overview;
    case "reviews":
      return APP_ROUTES.bewertungen.overview;
    case "staff":
      return APP_ROUTES.mitarbeiter.overview;
    case "inventory":
      return APP_ROUTES.inventory.overview;
    case "documents":
      return APP_ROUTES.dokumente.overview;
    case "news":
      return APP_ROUTES.news.overview;
    case "events":
      return APP_ROUTES.events.overview;
    case "accounting":
      return APP_ROUTES.buchfuehrung.invoices;
    case "gallery":
      return APP_ROUTES.galerie.overview;
    case "staff_todos":
      return APP_ROUTES.checklisten.todos;
    default: {
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}

/** Primär-CTA: zum konkreten Treffer („Zum Mitarbeiter“). */
export function dashboardGlobalSearchEntityCtaLabel(
  category: DashboardGlobalSearchCategory,
): string {
  switch (category) {
    case "menu":
      return "Zum Gericht";
    case "reservations":
      return "Zur Reservierung";
    case "contacts":
      return "Zum Kontakt";
    case "reviews":
      return "Zur Bewertung";
    case "staff":
      return "Zum Mitarbeiter";
    case "inventory":
      return "Zur Zutat";
    case "documents":
      return "Zum Dokument";
    case "news":
      return "Zur News";
    case "events":
      return "Zum Event";
    case "accounting":
      return "Zur Buchführung";
    case "gallery":
      return "Zur Galerie";
    case "staff_todos":
      return "Zum ToDo";
    default: {
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}

/** Sekundär-CTA: nur Modul-Übersicht. */
export function dashboardGlobalSearchModuleCtaLabel(
  category: DashboardGlobalSearchCategory,
): string {
  switch (category) {
    case "menu":
      return "Zur Speisekarte";
    case "reservations":
      return "Zu Reservierungen";
    case "contacts":
      return "Zu Kontakten";
    case "reviews":
      return "Zu Bewertungen";
    case "staff":
      return "Zu Mitarbeitern";
    case "inventory":
      return "Zum Bestand";
    case "documents":
      return "Zu Dokumenten";
    case "news":
      return "Zu News";
    case "events":
      return "Zu Events";
    case "accounting":
      return "Zur Buchführung";
    case "gallery":
      return "Zur Galerie";
    case "staff_todos":
      return "Zu ToDo-Listen";
    default: {
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}

/**
 * Ob der Treffer-Href vom Modul-Root abweicht (Deep-Link zum Eintrag).
 * Sonst nur ein CTA — Eintrag und Modul sind dieselbe Navigation.
 */
export function dashboardGlobalSearchHasEntityDeepLink(
  category: DashboardGlobalSearchCategory,
): boolean {
  switch (category) {
    case "menu":
    case "reservations":
    case "contacts":
    case "staff":
      return true;
    case "reviews":
    case "inventory":
    case "documents":
    case "news":
    case "events":
    case "accounting":
    case "gallery":
    case "staff_todos":
      return false;
    default: {
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}

export function dashboardGlobalSearchReservationDayHref(dayYmd: string): string {
  const p = new URLSearchParams();
  p.set("day", dayYmd);
  return `${APP_ROUTES.reservierungen.overview}?${p.toString()}`;
}

export function dashboardGlobalSearchResultHref(
  category: DashboardGlobalSearchCategory,
  id: string,
  options?: { dayYmd?: string | null },
): string {
  switch (category) {
    case "menu":
      return `${APP_ROUTES.menu.overview}?dish=${encodeURIComponent(id)}`;
    case "reservations": {
      const p = new URLSearchParams();
      p.set("reservation", id);
      if (options?.dayYmd && /^\d{4}-\d{2}-\d{2}$/.test(options.dayYmd)) {
        p.set("day", options.dayYmd);
      }
      return `${APP_ROUTES.reservierungen.overview}?${p.toString()}`;
    }
    case "contacts":
      return `${APP_ROUTES.kontakte.overview}?contact=${encodeURIComponent(id)}`;
    case "reviews":
      return APP_ROUTES.bewertungen.overview;
    case "staff":
      return `${APP_ROUTES.mitarbeiter.overview}?staff=${encodeURIComponent(id)}`;
    case "inventory":
      return APP_ROUTES.inventory.overview;
    case "documents":
      return APP_ROUTES.dokumente.overview;
    case "news":
      return APP_ROUTES.news.overview;
    case "events":
      return APP_ROUTES.events.overview;
    case "accounting":
      return APP_ROUTES.buchfuehrung.invoices;
    case "gallery":
      return APP_ROUTES.galerie.overview;
    case "staff_todos":
      return APP_ROUTES.checklisten.todos;
    default: {
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}
