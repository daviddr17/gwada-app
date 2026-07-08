import type { DashboardReservationSummary } from "@/lib/reservations/compute-dashboard-reservation-summary";
import { weekRangeUtcIso } from "@/lib/reservations/dashboard-period-range";
import { isUnconfirmedReservation } from "@/lib/reservations/unconfirmed-reservations";
import type { ReservationStatusJoin } from "@/lib/supabase/reservations-db";

export type ReservationLiveInsertFields = {
  id: string;
  starts_at: string;
  ends_at?: string;
  dwell_minutes?: number | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  party_size: number;
  statusId: string;
  statusCode: string;
  statusName: string;
  statusColorHex?: string;
};

const DEFAULT_LIVE_INSERT_DWELL_MINUTES = 120;

export function reservationEndsAtFromLiveInsert(
  insert: {
    starts_at: string;
    ends_at?: string | null;
    dwell_minutes?: number | null;
  },
): string {
  if (insert.ends_at && Number.isFinite(new Date(insert.ends_at).getTime())) {
    return insert.ends_at;
  }
  const dwell = insert.dwell_minutes ?? DEFAULT_LIVE_INSERT_DWELL_MINUTES;
  const startMs = new Date(insert.starts_at).getTime();
  if (!Number.isFinite(startMs)) return insert.starts_at;
  return new Date(startMs + dwell * 60 * 1000).toISOString();
}

export function reservationLiveInsertListRowRaw(
  insert: ReservationLiveInsertFields,
  restaurantId: string,
): Record<string, unknown> {
  return {
    id: insert.id,
    restaurant_id: restaurantId,
    starts_at: insert.starts_at,
    ends_at: reservationEndsAtFromLiveInsert(insert),
    dwell_minutes: insert.dwell_minutes ?? DEFAULT_LIVE_INSERT_DWELL_MINUTES,
    guest_first_name: insert.guest_first_name,
    guest_last_name: insert.guest_last_name,
    party_size: insert.party_size,
    reservation_statuses: {
      code: insert.statusCode,
      name: insert.statusName,
      id: insert.statusId,
      color_hex: insert.statusColorHex ?? DEFAULT_PENDING_STATUS.color_hex,
    },
  };
}

const DEFAULT_PENDING_STATUS: ReservationStatusJoin = {
  id: "",
  code: "pending",
  name: "Unbestätigt",
  color_hex: "#eab308",
};

const DASHBOARD_RESERVATION_UNCONFIRMED_LIMIT = 4;
const DASHBOARD_RESERVATION_TODAY_LIMIT = 6;

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
      ? (status as {
          id?: string;
          code?: string;
          name?: string;
          color_hex?: string;
        })
      : null;

  return {
    id,
    starts_at: startsAt,
    ends_at: typeof row.ends_at === "string" ? row.ends_at : undefined,
    dwell_minutes:
      typeof row.dwell_minutes === "number" ? row.dwell_minutes : undefined,
    guest_first_name:
      typeof row.guest_first_name === "string" ? row.guest_first_name : null,
    guest_last_name:
      typeof row.guest_last_name === "string" ? row.guest_last_name : null,
    party_size:
      Number.isFinite(partySize) && partySize > 0 ? partySize : 1,
    statusId: statusObj?.id ?? "",
    statusCode: statusObj?.code ?? DEFAULT_PENDING_STATUS.code,
    statusName: statusObj?.name ?? DEFAULT_PENDING_STATUS.name,
    statusColorHex: statusObj?.color_hex,
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

  if (isUnconfirmedReservation(rowLike)) {
    const withoutDup = next.unconfirmedList.filter((r) => r.id !== insert.id);
    next = {
      ...next,
      unconfirmedList: [recentEntry, ...withoutDup]
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        )
        .slice(0, DASHBOARD_RESERVATION_UNCONFIRMED_LIMIT),
    };
  }

  if (counts && inWeek && dayKeyFromIso(insert.starts_at) === todayKey) {
    const withoutDup = next.todayList.filter((r) => r.id !== insert.id);
    next = {
      ...next,
      todayList: [recentEntry, ...withoutDup]
        .sort(
          (a, b) =>
            new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
        )
        .slice(0, DASHBOARD_RESERVATION_TODAY_LIMIT),
    };
  }

  return next;
}

/** KPI: offene Reservierung erledigt (Bestätigen / Änderung). */
export function patchDashboardReservationSummaryResolvedOpen(
  summary: DashboardReservationSummary,
  reservationId: string,
): DashboardReservationSummary {
  const hadEntry = summary.unconfirmedList.some((r) => r.id === reservationId);
  const nextCount = Math.max(0, summary.unconfirmedCount - 1);
  if (!hadEntry && summary.unconfirmedCount <= 0) {
    return summary;
  }
  return {
    ...summary,
    unconfirmedCount: nextCount,
    unconfirmedList: summary.unconfirmedList.filter((r) => r.id !== reservationId),
  };
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
