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
  weekReservations: number;
  weekGuests: number;
  avgPartySizeWeek: number | null;
  recent: DashboardReservationRecent[];
};

function statusCode(row: ReservationListRow): string {
  return row.reservation_statuses?.code ?? "";
}

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayKeyFromIso(iso: string): string {
  return localDayKey(new Date(iso));
}

/** Zählt in Kennzahlen (keine Stornos / Absagen / No-Shows). */
function countsTowardGuestTotals(row: ReservationListRow): boolean {
  const code = statusCode(row);
  return code !== "cancelled" && code !== "declined" && code !== "no_show";
}

export function computeDashboardReservationSummary(
  weekRows: ReservationListRow[],
  upcomingRows: ReservationListRow[],
  today: Date = new Date(),
): DashboardReservationSummary {
  const todayKey = localDayKey(today);

  const unconfirmedCount = upcomingRows.filter(isUnconfirmedReservation).length;

  let todayReservations = 0;
  let todayGuests = 0;
  let weekReservations = 0;
  let weekGuests = 0;

  for (const row of weekRows) {
    if (!countsTowardGuestTotals(row)) continue;
    const guests = Math.max(0, row.party_size ?? 0);
    weekReservations += 1;
    weekGuests += guests;
    if (dayKeyFromIso(row.starts_at) === todayKey) {
      todayReservations += 1;
      todayGuests += guests;
    }
  }

  const avgPartySizeWeek =
    weekReservations > 0
      ? Math.round((weekGuests / weekReservations) * 10) / 10
      : null;

  const nowMs = today.getTime();
  const recent = [...upcomingRows]
    .filter(countsTowardGuestTotals)
    .filter((row) => new Date(row.starts_at).getTime() >= nowMs)
    .sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    )
    .slice(0, 4)
    .map((row) => {
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
    });

  return {
    unconfirmedCount,
    todayReservations,
    todayGuests,
    weekReservations,
    weekGuests,
    avgPartySizeWeek,
    recent,
  };
}
