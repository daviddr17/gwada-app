import { APP_ROUTES } from "@/lib/navigation/app-routes";

export const PRIVATE_EVENT_QUERY = "privateEvent";
export const NEW_PRIVATE_EVENT_QUERY = "newPrivate";

export function privateEventOverviewHref(reservationId?: string | null): string {
  const base = APP_ROUTES.events.overview;
  if (!reservationId) return base;
  const p = new URLSearchParams();
  p.set(PRIVATE_EVENT_QUERY, reservationId);
  return `${base}?${p.toString()}`;
}

export function newPrivateEventOverviewHref(dayYmd?: string | null): string {
  const p = new URLSearchParams();
  p.set(NEW_PRIVATE_EVENT_QUERY, "1");
  if (dayYmd) p.set("day", dayYmd);
  return `${APP_ROUTES.events.overview}?${p.toString()}`;
}

export function eventsOverviewDayHref(dayYmd: string): string {
  const p = new URLSearchParams();
  p.set("day", dayYmd);
  p.set("filter", "private");
  return `${APP_ROUTES.events.overview}?${p.toString()}`;
}
