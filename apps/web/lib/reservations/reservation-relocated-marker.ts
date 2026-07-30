import type { ReservationListRow } from "@/lib/supabase/reservations-db";
import { reservationDateTimeChanged } from "@/lib/reservations/reservation-datetime-reschedule";

/** Status-Darstellung „Verschoben“ — nur für Platzhalter-Karten, nicht Live-Status der Buchung. */
export const RESERVATION_MOVED_STATUS_CODE = "moved";
export const RESERVATION_MOVED_STATUS_NAME = "Verschoben";
export const RESERVATION_MOVED_STATUS_COLOR = "#6366f1";

/** Prefixed id so React keys / click handlers can open the live reservation. */
export const RELOCATED_MARKER_ID_PREFIX = "relocated:";

export function isRelocatedMarkerRow(
  r: Pick<ReservationListRow, "id"> | { id: string },
): boolean {
  return r.id.startsWith(RELOCATED_MARKER_ID_PREFIX);
}

export function liveReservationIdFromListRowId(id: string): string {
  return id.startsWith(RELOCATED_MARKER_ID_PREFIX)
    ? id.slice(RELOCATED_MARKER_ID_PREFIX.length)
    : id;
}

export type RelocatedFromPatch = {
  relocated_from_starts_at: string | null;
  relocated_from_ends_at: string | null;
  relocated_from_dining_table_id: string | null;
};

/** Bei Terminwechsel: alten Slot merken; sonst Marker löschen. */
export function relocatedFromPatchOnDatetimeChange(params: {
  beforeStartsAt: string;
  beforeEndsAt: string;
  afterStartsAt: string;
  afterEndsAt: string;
  beforeDiningTableId: string | null;
}): RelocatedFromPatch {
  const moved = reservationDateTimeChanged(
    { starts_at: params.beforeStartsAt, ends_at: params.beforeEndsAt },
    { starts_at: params.afterStartsAt, ends_at: params.afterEndsAt },
  );
  if (!moved) {
    return {
      relocated_from_starts_at: null,
      relocated_from_ends_at: null,
      relocated_from_dining_table_id: null,
    };
  }
  return {
    relocated_from_starts_at: params.beforeStartsAt,
    relocated_from_ends_at: params.beforeEndsAt,
    relocated_from_dining_table_id: params.beforeDiningTableId,
  };
}

export function reservationHasRelocatedFromSlot(
  r: Pick<
    ReservationListRow,
    "relocated_from_starts_at" | "relocated_from_ends_at"
  >,
): boolean {
  return Boolean(r.relocated_from_starts_at && r.relocated_from_ends_at);
}

/** Platzhalter-Zeile am alten Slot (gleiche Buchung, Status „Verschoben“). */
export function relocatedMarkerListRowFromReservation(
  r: ReservationListRow,
): ReservationListRow | null {
  if (!r.relocated_from_starts_at || !r.relocated_from_ends_at) return null;
  const table =
    r.relocated_from_dining_table_id &&
    r.dining_tables?.id === r.relocated_from_dining_table_id
      ? r.dining_tables
      : r.relocated_from_dining_table_id
        ? {
            id: r.relocated_from_dining_table_id,
            table_number: 0,
            table_name: "Tisch",
            area_id: "",
          }
        : null;

  return {
    ...r,
    id: `${RELOCATED_MARKER_ID_PREFIX}${r.id}`,
    starts_at: r.relocated_from_starts_at,
    ends_at: r.relocated_from_ends_at,
    dining_table_id: r.relocated_from_dining_table_id,
    dining_tables: table,
    pending_change: null,
    status_before_change_id: null,
    reservation_statuses: {
      id: RESERVATION_MOVED_STATUS_CODE,
      code: RESERVATION_MOVED_STATUS_CODE,
      name: RESERVATION_MOVED_STATUS_NAME,
      color_hex: RESERVATION_MOVED_STATUS_COLOR,
    },
  };
}

/**
 * Live-Buchungen + Platzhalter für alte Slots im angefragten Zeitraum.
 * `rows` muss Live-Zeilen (starts_at im Range) und ggf. „nur Marker“-Zeilen enthalten.
 */
export function expandReservationsWithRelocatedMarkers(
  rows: ReservationListRow[],
  rangeStartIso: string,
  rangeEndExclusiveIso: string,
): ReservationListRow[] {
  const rangeStart = new Date(rangeStartIso).getTime();
  const rangeEnd = new Date(rangeEndExclusiveIso).getTime();
  const out: ReservationListRow[] = [];
  const seenLive = new Set<string>();

  for (const r of rows) {
    if (isRelocatedMarkerRow(r)) continue;
    const startMs = new Date(r.starts_at).getTime();
    if (startMs >= rangeStart && startMs < rangeEnd) {
      out.push(r);
      seenLive.add(r.id);
    }
    const marker = relocatedMarkerListRowFromReservation(r);
    if (!marker) continue;
    const oldMs = new Date(marker.starts_at).getTime();
    if (oldMs >= rangeStart && oldMs < rangeEnd) {
      out.push(marker);
    }
  }

  void seenLive;
  out.sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );
  return out;
}

/** Für Tageszähler / Perioden-Statistik: Platzhalter nicht mitzählen. */
export function reservationCountsTowardDayStats(
  r: Pick<ReservationListRow, "id">,
): boolean {
  return !isRelocatedMarkerRow(r);
}
