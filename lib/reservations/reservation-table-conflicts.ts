import { formatDiningTableLabel, type DiningTableRow } from "@/lib/supabase/dining-floor-db";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";
import { isConfirmedReservationStatus } from "@/lib/reservations/reservation-table-assignment";

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
      isConfirmedReservationStatus(r.reservation_statuses) &&
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
  const label = formatDiningTableLabel(table);

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
