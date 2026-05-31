import type { DiningTableRow } from "@/lib/supabase/dining-floor-db";
import {
  reservationActiveAtInstant,
} from "@/lib/reservations/day-opening-slots";

export type TableOccupancyReservation = {
  id: string;
  party_size: number;
  starts_at: string;
  ends_at: string;
  dining_table_id: string | null;
};

type TableOccupancyReservationWithStatus = TableOccupancyReservation & {
  status?: { code: string } | null;
  reservation_statuses?: { code: string } | null;
};

export function reservationOverlapsTimeRange(
  r: Pick<TableOccupancyReservation, "starts_at" | "ends_at">,
  rangeStart: Date,
  rangeEnd: Date,
): boolean {
  const rStart = new Date(r.starts_at).getTime();
  const rEnd = new Date(r.ends_at).getTime();
  return rStart < rangeEnd.getTime() && rEnd > rangeStart.getTime();
}

export function reservationOccupiesTableAtInstant(
  statusCode: string | null | undefined,
  options?: { includeSeated?: boolean },
): boolean {
  if (statusCode === "confirmed") return true;
  if (options?.includeSeated && statusCode === "seated") return true;
  return false;
}

function readStatusCode(r: TableOccupancyReservationWithStatus): string | null {
  if (r.status?.code) return r.status.code;
  if (r.reservation_statuses?.code) return r.reservation_statuses.code;
  return null;
}

export function reservationsAtTableForInstant<
  T extends TableOccupancyReservationWithStatus,
>(
  tables: DiningTableRow[],
  reservations: T[],
  instant: Date,
  options?: { includeSeated?: boolean },
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  const tableIds = new Set(tables.map((t) => t.id));
  for (const r of reservations) {
    const code = readStatusCode(r);
    if (
      !reservationOccupiesTableAtInstant(code, options) ||
      !r.dining_table_id ||
      !tableIds.has(r.dining_table_id)
    ) {
      continue;
    }
    if (!reservationActiveAtInstant(r, instant)) continue;
    const arr = map.get(r.dining_table_id) ?? [];
    arr.push(r);
    map.set(r.dining_table_id, arr);
  }
  for (const arr of map.values()) {
    arr.sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );
  }
  return map;
}

/** Alle Reservierungen pro Tisch, die den Zeitraum [rangeStart, rangeEnd) überlappen. */
export function reservationsAtTableForRange<
  T extends TableOccupancyReservationWithStatus,
>(
  tables: DiningTableRow[],
  reservations: T[],
  rangeStart: Date,
  rangeEnd: Date,
  options?: { includeSeated?: boolean },
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  const tableIds = new Set(tables.map((t) => t.id));
  for (const r of reservations) {
    const code = readStatusCode(r);
    if (
      !reservationOccupiesTableAtInstant(code, options) ||
      !r.dining_table_id ||
      !tableIds.has(r.dining_table_id)
    ) {
      continue;
    }
    if (!reservationOverlapsTimeRange(r, rangeStart, rangeEnd)) continue;
    const arr = map.get(r.dining_table_id) ?? [];
    arr.push(r);
    map.set(r.dining_table_id, arr);
  }
  for (const arr of map.values()) {
    arr.sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );
  }
  return map;
}

export function computeTableSlotStats(
  tables: DiningTableRow[],
  occupancy: Map<string, TableOccupancyReservation[]>,
): {
  freeTables: number;
  occupiedTables: number;
  freeSeats: number;
  occupiedSeats: number;
  totalSeats: number;
} {
  let occupiedTables = 0;
  let occupiedSeats = 0;
  let totalSeats = 0;
  for (const t of tables) {
    const cap = Math.max(0, Number(t.capacity) || 0);
    totalSeats += cap;
    const list = occupancy.get(t.id) ?? [];
    if (list.length > 0) {
      occupiedTables += 1;
      occupiedSeats += list.reduce((sum, r) => sum + r.party_size, 0);
    }
  }
  return {
    freeTables: tables.length - occupiedTables,
    occupiedTables,
    freeSeats: Math.max(0, totalSeats - occupiedSeats),
    occupiedSeats,
    totalSeats,
  };
}
