import {
  formatDiningTableSelectLabel,
  type DiningTableRow,
} from "@/lib/supabase/dining-floor-db";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";
import { reservationContributesToTableOccupancy } from "@/lib/reservations/reservation-table-assignment";

/** Halb-offene Überlappung: [aStart,aEnd) vs [bStart,bEnd) — hier mit DB-Konvention start <= t < end. */
export function reservationsIntervalsOverlap(
  aStartIso: string,
  aEndIso: string,
  bStartIso: string,
  bEndIso: string,
): boolean {
  const a0 = new Date(aStartIso).getTime();
  const a1 = new Date(aEndIso).getTime();
  const b0 = new Date(bStartIso).getTime();
  const b1 = new Date(bEndIso).getTime();
  return a0 < b1 && a1 > b0;
}

export type TableAssignmentCheck =
  | { kind: "ok" }
  | { kind: "capacity_exceeded"; message: string }
  | {
      kind: "confirm_share";
      seatUsed: number;
      otherCount: number;
      capacity: number;
      remaining: number;
      partySize: number;
      tableLabel: string;
    };

export function checkTableAssignmentForSave(params: {
  tableId: string | null;
  partySize: number;
  startsAt: string;
  endsAt: string;
  excludeReservationId: string | null;
  tables: DiningTableRow[];
  knownReservations: ReservationListRow[];
}): TableAssignmentCheck {
  if (!params.tableId) return { kind: "ok" };
  const table = params.tables.find((t) => t.id === params.tableId);
  if (!table) return { kind: "ok" };

  const overlaps = params.knownReservations.filter(
    (r) =>
      r.id !== params.excludeReservationId &&
      reservationContributesToTableOccupancy(r.reservation_statuses) &&
      r.dining_table_id === params.tableId &&
      reservationsIntervalsOverlap(
        r.starts_at,
        r.ends_at,
        params.startsAt,
        params.endsAt,
      ),
  );

  if (overlaps.length === 0) return { kind: "ok" };

  const seatUsed = overlaps.reduce((sum, r) => sum + r.party_size, 0);
  const cap = Math.max(0, table.capacity);
  const label = formatDiningTableSelectLabel(table);

  if (seatUsed + params.partySize > cap) {
    return {
      kind: "capacity_exceeded",
      message: `Zur gewählten Zeit sind am Tisch „${label}“ bereits ${seatUsed} Personen vorgemerkt (Kapazität ${cap}). Mit ${params.partySize} weiteren Personen würde die Kapazität überschritten. Bitte einen anderen Tisch wählen oder Zeiten anpassen.`,
    };
  }

  return {
    kind: "confirm_share",
    seatUsed,
    otherCount: overlaps.length,
    capacity: cap,
    remaining: cap - seatUsed,
    partySize: params.partySize,
    tableLabel: label,
  };
}

export type TableAssignmentSuggestion = {
  tableId: string;
  label: string;
  kind: "free" | "share";
};

/** Freie oder teilweise freie Tische für eine Reservierung (nach Ablehnung eines belegten Tisches). */
export function suggestAlternativeTables(params: {
  partySize: number;
  startsAt: string;
  endsAt: string;
  excludeReservationId: string | null;
  skipTableIds?: string[];
  tables: DiningTableRow[];
  knownReservations: ReservationListRow[];
  limit?: number;
}): TableAssignmentSuggestion[] {
  const limit = params.limit ?? 4;
  const skip = new Set(params.skipTableIds ?? []);
  const active = params.tables.filter((t) => t.is_active !== false);
  const ranked: { score: number; item: TableAssignmentSuggestion }[] = [];

  for (const table of active) {
    if (skip.has(table.id)) continue;
    const check = checkTableAssignmentForSave({
      tableId: table.id,
      partySize: params.partySize,
      startsAt: params.startsAt,
      endsAt: params.endsAt,
      excludeReservationId: params.excludeReservationId,
      tables: active,
      knownReservations: params.knownReservations,
    });
    if (check.kind === "capacity_exceeded") continue;

    const label = formatDiningTableSelectLabel(table);
    if (check.kind === "confirm_share") {
      ranked.push({
        score: 400 + check.seatUsed * 15 - Math.max(0, check.remaining - params.partySize),
        item: { tableId: table.id, label, kind: "share" },
      });
    } else {
      ranked.push({
        score: 1000 - Math.max(0, table.capacity - params.partySize),
        item: { tableId: table.id, label, kind: "free" },
      });
    }
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit).map((x) => x.item);
}
