import {
  DEFAULT_RESTAURANT_TIMEZONE,
  restaurantZonedDateKey,
} from "@/lib/restaurant/restaurant-timezone";
import { isUnconfirmedReservation } from "@/lib/reservations/unconfirmed-reservations";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";

export type DashboardReservationRecent = {
  id: string;
  guestLabel: string;
  startsAt: string;
  partySize: number;
  statusName: string;
  href: string;
  unconfirmed: boolean;
};

export type DashboardReservationSummary = {
  unconfirmedCount: number;
  todayReservations: number;
  todayGuests: number;
  /** Heute, Startzeit ab jetzt — für Heute-Widget. */
  todayUpcomingReservations: number;
  todayUpcomingGuests: number;
  weekReservations: number;
  weekGuests: number;
  avgPartySizeWeek: number | null;
  /** Unbestätigte Reservierungen (Sheet & Aufmerksamkeit). */
  unconfirmedList: DashboardReservationRecent[];
  /** Heutige Reservierungen (Legacy-Vorschau). */
  todayList: DashboardReservationRecent[];
  /** Heute anstehend — vollständige Liste für Bottom Sheet. */
  todayUpcomingList: DashboardReservationRecent[];
};

const DASHBOARD_RESERVATION_UNCONFIRMED_LIMIT = 50;
const DASHBOARD_RESERVATION_TODAY_LIMIT = 6;
const DASHBOARD_RESERVATION_SHEET_LIMIT = 50;

function statusCode(row: ReservationListRow): string {
  return row.reservation_statuses?.code ?? "";
}

function dayKeyFromIso(iso: string, timeZone: string): string {
  return restaurantZonedDateKey(new Date(iso), timeZone);
}

/** Zählt in Kennzahlen (keine Stornos / Absagen / No-Shows). */
function countsTowardGuestTotals(row: ReservationListRow): boolean {
  const code = statusCode(row);
  return code !== "cancelled" && code !== "declined" && code !== "no_show";
}

function toRecentRow(row: ReservationListRow): DashboardReservationRecent {
  const guestLabel =
    `${row.guest_first_name} ${row.guest_last_name}`.trim() || "Gast";
  return {
    id: row.id,
    guestLabel,
    startsAt: row.starts_at,
    partySize: row.party_size,
    statusName: row.reservation_statuses?.name ?? "—",
    href: `/dashboard/reservierungen/uebersicht?reservation=${row.id}`,
    unconfirmed: isUnconfirmedReservation(row),
  };
}

function buildRecentList(
  rows: ReservationListRow[],
  limit: number,
): DashboardReservationRecent[] {
  return [...rows]
    .sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    )
    .slice(0, limit)
    .map(toRecentRow);
}

export function computeDashboardReservationSummary(
  weekRows: ReservationListRow[],
  upcomingRows: ReservationListRow[],
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
  today: Date = new Date(),
): DashboardReservationSummary {
  const todayKey = restaurantZonedDateKey(today, timeZone);

  const unconfirmedCount = upcomingRows.filter(isUnconfirmedReservation).length;

  let todayReservations = 0;
  let todayGuests = 0;
  let todayUpcomingReservations = 0;
  let todayUpcomingGuests = 0;
  let weekReservations = 0;
  let weekGuests = 0;
  const nowMs = today.getTime();

  for (const row of weekRows) {
    if (!countsTowardGuestTotals(row)) continue;
    const guests = Math.max(0, row.party_size ?? 0);
    weekReservations += 1;
    weekGuests += guests;
    if (dayKeyFromIso(row.starts_at, timeZone) === todayKey) {
      todayReservations += 1;
      todayGuests += guests;
      if (new Date(row.starts_at).getTime() >= nowMs) {
        todayUpcomingReservations += 1;
        todayUpcomingGuests += guests;
      }
    }
  }

  const avgPartySizeWeek =
    weekReservations > 0
      ? Math.round((weekGuests / weekReservations) * 10) / 10
      : null;

  const unconfirmedList = buildRecentList(
    upcomingRows.filter(isUnconfirmedReservation),
    DASHBOARD_RESERVATION_UNCONFIRMED_LIMIT,
  );

  const todayList = buildRecentList(
    weekRows.filter(
      (row) =>
        countsTowardGuestTotals(row) &&
        dayKeyFromIso(row.starts_at, timeZone) === todayKey,
    ),
    DASHBOARD_RESERVATION_TODAY_LIMIT,
  );

  const todayUpcomingList = buildRecentList(
    weekRows.filter(
      (row) =>
        countsTowardGuestTotals(row) &&
        dayKeyFromIso(row.starts_at, timeZone) === todayKey &&
        new Date(row.starts_at).getTime() >= nowMs,
    ),
    DASHBOARD_RESERVATION_SHEET_LIMIT,
  );

  return {
    unconfirmedCount,
    todayReservations,
    todayGuests,
    todayUpcomingReservations,
    todayUpcomingGuests,
    weekReservations,
    weekGuests,
    avgPartySizeWeek,
    unconfirmedList,
    todayList,
    todayUpcomingList,
  };
}
