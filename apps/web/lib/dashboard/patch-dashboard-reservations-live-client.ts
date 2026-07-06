import type { DashboardReservationSummary } from "@/lib/reservations/compute-dashboard-reservation-summary";
import {
  weekRangeUtcIso,
} from "@/lib/reservations/dashboard-period-range";
import { isUnconfirmedReservation } from "@/lib/reservations/unconfirmed-reservations";
import type { ReservationStatusJoin } from "@/lib/supabase/reservations-db";

export type ReservationLiveInsertFields = {
  id: string;
  starts_at: string;
  guest_first_name: string | null;
  guest_last_name: string | null;
  party_size: number;
  statusCode: string;
  statusName: string;
};

const DEFAULT_PENDING_STATUS: ReservationStatusJoin = {
  id: "",
  code: "pending",
  name: "Unbestätigt",
  color_hex: "#eab308",
};

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayKeyFromIso(iso: string): string {
  return localDayKey(new Date(iso));
}

function countsTowardGuestTotals(statusCode: string): boolean {
  return (
    statusCode !== "cancelled" &&
    statusCode !== "declined" &&
    statusCode !== "no_show"
  );
}

function isInWeekRange(startsAtIso: string, today: Date): boolean {
  const week = weekRangeUtcIso(today);
  const t = new Date(startsAtIso).getTime();
  return (
    t >= new Date(week.rangeStartIso).getTime() &&
    t < new Date(week.rangeEndExclusiveIso).getTime()
  );
}

export function reservationLiveInsertFromRecord(
  row: Record<string, unknown>,
): ReservationLiveInsertFields | null {
  const id = row.id;
  const startsAt = row.starts_at;
  if (typeof id !== "string" || typeof startsAt !== "string") return null;

  const partyRaw = row.party_size;
  const partySize =
    typeof partyRaw === "number"
      ? partyRaw
      : typeof partyRaw === "string"
        ? Number.parseInt(partyRaw, 10)
        : 1;

  const st = row.reservation_statuses;
  const status = Array.isArray(st) ? (st[0] ?? null) : st;
  const statusObj =
    status && typeof status === "object"
      ? (status as { code?: string; name?: string })
      : null;

  return {
    id,
    starts_at: startsAt,
    guest_first_name:
      typeof row.guest_first_name === "string" ? row.guest_first_name : null,
    guest_last_name:
      typeof row.guest_last_name === "string" ? row.guest_last_name : null,
    party_size:
      Number.isFinite(partySize) && partySize > 0 ? partySize : 1,
    statusCode: statusObj?.code ?? DEFAULT_PENDING_STATUS.code,
    statusName: statusObj?.name ?? DEFAULT_PENDING_STATUS.name,
  };
}

/** Inkrementelles KPI-Patch — kein Batch-Refetch nötig. */
export function patchDashboardReservationSummaryFromInsert(
  summary: DashboardReservationSummary,
  insert: ReservationLiveInsertFields,
  today: Date = new Date(),
): DashboardReservationSummary {
  const statusJoin: ReservationStatusJoin = {
    ...DEFAULT_PENDING_STATUS,
    code: insert.statusCode,
    name: insert.statusName,
  };
  const rowLike = { reservation_statuses: statusJoin };
  const guests = Math.max(0, insert.party_size);
  const todayKey = localDayKey(today);
  const inWeek = isInWeekRange(insert.starts_at, today);
  const counts = countsTowardGuestTotals(insert.statusCode);

  let next = { ...summary };

  if (isUnconfirmedReservation(rowLike)) {
    next = { ...next, unconfirmedCount: next.unconfirmedCount + 1 };
  }

  if (counts && inWeek) {
    next = {
      ...next,
      weekReservations: next.weekReservations + 1,
      weekGuests: next.weekGuests + guests,
    };
    if (dayKeyFromIso(insert.starts_at) === todayKey) {
      next = {
        ...next,
        todayReservations: next.todayReservations + 1,
        todayGuests: next.todayGuests + guests,
      };
    }
    const weekTotal = next.weekReservations;
    next = {
      ...next,
      avgPartySizeWeek:
        weekTotal > 0
          ? Math.round((next.weekGuests / weekTotal) * 10) / 10
          : null,
    };
  }

  const nowMs = today.getTime();
  const guestLabel =
    `${insert.guest_first_name ?? ""} ${insert.guest_last_name ?? ""}`.trim() ||
    "Gast";
  const recentEntry = {
    id: insert.id,
    guestLabel,
    startsAt: insert.starts_at,
    partySize: insert.party_size,
    statusName: insert.statusName,
    href: `/dashboard/reservierungen/uebersicht?reservation=${insert.id}`,
    unconfirmed: isUnconfirmedReservation(rowLike),
  };

  if (counts && new Date(insert.starts_at).getTime() >= nowMs) {
    const withoutDup = next.recent.filter((r) => r.id !== insert.id);
    next = {
      ...next,
      recent: [recentEntry, ...withoutDup]
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        )
        .slice(0, 4),
    };
  }

  if (counts && inWeek && dayKeyFromIso(insert.starts_at) === todayKey) {
    const withoutDup = (next.todayList ?? []).filter((r) => r.id !== insert.id);
    next = {
      ...next,
      todayList: [recentEntry, ...withoutDup]
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        )
        .slice(0, 6),
    };
  }

  return next;
}

export function reservationInsertInMonthRange(
  startsAtIso: string,
  range: { rangeStartIso: string; rangeEndExclusiveIso: string },
): boolean {
  const t = new Date(startsAtIso).getTime();
  return (
    t >= new Date(range.rangeStartIso).getTime() &&
    t < new Date(range.rangeEndExclusiveIso).getTime()
  );
}

export function reservationInsertOnLocalDay(
  startsAtIso: string,
  dayYmd: string,
): boolean {
  return dayKeyFromIso(startsAtIso) === dayYmd;
}

/** Display-Tagesstatistik (+1 Reservierung / Gäste). */
export function patchDisplayDayStatsFromInsert(
  stats: { count: number; guests: number },
  insert: ReservationLiveInsertFields,
): { count: number; guests: number } {
  if (!countsTowardGuestTotals(insert.statusCode)) return stats;
  return {
    count: stats.count + 1,
    guests: stats.guests + Math.max(0, insert.party_size),
  };
}
