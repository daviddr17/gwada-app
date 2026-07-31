/** Leichte Dashboard-KPIs für Modul-Widgets (Batch-Summary). */

export type DashboardPosSummary = {
  ordersToday: number;
  revenueCentsToday: number;
  avgTicketCentsToday: number | null;
  openSessions: number;
};

export type DashboardEventsSummary = {
  total: number;
  upcoming: number;
  draft: number;
};

export type DashboardNewsSummary = {
  published: number;
  scheduled: number;
  draft: number;
};

export type DashboardInsightsSummary = {
  reservations30d: number;
  avgRating: number | null;
  messages30d: number;
};

export type DashboardGallerySummary = {
  mediaTotal: number;
  highlights: number;
  storageBytes: number;
};

export type DashboardAccountingSummary = {
  openInvoices: number;
  invoices30d: number;
  vouchers30d: number;
};

export type DashboardDocumentsSummary = {
  total: number;
  withoutTag: number;
  storageBytes: number;
};

export type DashboardChecklistsSummary = {
  openTodos: number;
  overdueTodos: number;
  capturesToday: number;
};
