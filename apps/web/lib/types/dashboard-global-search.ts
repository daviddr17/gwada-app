export type DashboardGlobalSearchCategory =
  | "menu"
  | "reservations"
  | "contacts"
  | "reviews"
  | "staff"
  | "inventory"
  | "documents"
  | "news"
  | "events"
  | "accounting"
  | "gallery"
  | "staff_todos";

export type DashboardGlobalSearchResultItem = {
  id: string;
  category: DashboardGlobalSearchCategory;
  title: string;
  subtitle: string | null;
  href: string;
};

export type DashboardGlobalSearchGroup = {
  category: DashboardGlobalSearchCategory;
  label: string;
  items: DashboardGlobalSearchResultItem[];
};

export type DashboardGlobalSearchResponse = {
  query: string;
  groups: DashboardGlobalSearchGroup[];
};

export const DASHBOARD_GLOBAL_SEARCH_MIN_QUERY_LENGTH = 2;

export const DASHBOARD_GLOBAL_SEARCH_LIMIT_PER_CATEGORY = 6;
