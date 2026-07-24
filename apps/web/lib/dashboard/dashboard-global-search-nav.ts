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
      return `${APP_ROUTES.mitarbeiter.hours}?staff=${encodeURIComponent(id)}`;
    case "inventory":
      return APP_ROUTES.inventory.overview;
    case "documents":
      return APP_ROUTES.dokumente.overview;
    case "news":
      return "/dashboard/news/uebersicht";
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
