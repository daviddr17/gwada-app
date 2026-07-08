import type { DisplayReservationRow } from "@/lib/display/display-reservations-server";
import {
  DEFAULT_RESTAURANT_TIMEZONE,
  restaurantZonedDateKey,
} from "@/lib/restaurant/restaurant-timezone";
import { sortReservationsByStart } from "@/lib/reservations/sort-reservations-by-start";

export { sortReservationsByStart };

function countsTowardDisplayStats(code: string | undefined): boolean {
  return (
    code !== "cancelled" && code !== "declined" && code !== "no_show"
  );
}

export function displayReservationOnDay(
  row: Pick<DisplayReservationRow, "starts_at">,
  dayYmd: string,
  timeZone: string = DEFAULT_RESTAURANT_TIMEZONE,
): boolean {
  const d = new Date(row.starts_at);
  if (Number.isNaN(d.getTime())) return false;
  return restaurantZonedDateKey(d, timeZone) === dayYmd;
}

export type DisplayDayPayloadPatch = {
  reservations: DisplayReservationRow[];
  stats: { count: number; guests: number };
};

export function patchDisplayDayFromReservationInsert(
  payload: DisplayDayPayloadPatch,
  row: DisplayReservationRow,
): DisplayDayPayloadPatch {
  if (payload.reservations.some((r) => r.id === row.id)) {
    return patchDisplayDayFromReservationUpdate(payload, row);
  }

  const reservations = sortReservationsByStart([
    ...payload.reservations,
    row,
  ]);
  const code = row.status?.code;
  if (!countsTowardDisplayStats(code)) {
    return { ...payload, reservations };
  }

  return {
    reservations,
    stats: {
      count: payload.stats.count + 1,
      guests: payload.stats.guests + Math.max(0, row.party_size),
    },
  };
}

export function patchDisplayDayFromReservationUpdate(
  payload: DisplayDayPayloadPatch,
  row: DisplayReservationRow,
): DisplayDayPayloadPatch {
  const prev = payload.reservations.find((r) => r.id === row.id);
  if (!prev) {
    return patchDisplayDayFromReservationInsert(payload, row);
  }

  const prevCounts = countsTowardDisplayStats(prev.status?.code);
  const nextCounts = countsTowardDisplayStats(row.status?.code);
  let stats = payload.stats;

  if (prevCounts && !nextCounts) {
    stats = {
      count: Math.max(0, stats.count - 1),
      guests: Math.max(0, stats.guests - prev.party_size),
    };
  } else if (!prevCounts && nextCounts) {
    stats = {
      count: stats.count + 1,
      guests: stats.guests + row.party_size,
    };
  } else if (prevCounts && nextCounts && prev.party_size !== row.party_size) {
    stats = {
      ...stats,
      guests: Math.max(
        0,
        stats.guests - prev.party_size + row.party_size,
      ),
    };
  }

  return {
    stats,
    reservations: sortReservationsByStart(
      payload.reservations.map((r) => (r.id === row.id ? row : r)),
    ),
  };
}

export function patchDisplayDayFromReservationRemove(
  payload: DisplayDayPayloadPatch,
  reservationId: string,
): DisplayDayPayloadPatch {
  const prev = payload.reservations.find((r) => r.id === reservationId);
  if (!prev) return payload;

  const reservations = payload.reservations.filter((r) => r.id !== reservationId);
  const prevCounts = countsTowardDisplayStats(prev.status?.code);
  if (!prevCounts) {
    return { ...payload, reservations };
  }

  return {
    reservations,
    stats: {
      count: Math.max(0, payload.stats.count - 1),
      guests: Math.max(0, payload.stats.guests - prev.party_size),
    },
  };
}
