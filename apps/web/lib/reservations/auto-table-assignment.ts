import {
  formatDiningTableLabel,
  type DiningTableRow,
} from "@/lib/supabase/dining-floor-db";
import type { ReservationListRow } from "@/lib/supabase/reservations-db";
import { checkTableAssignmentForSave } from "@/lib/reservations/reservation-table-conflicts";
import {
  isConfirmedReservationStatus,
  reservationContributesToTableOccupancy,
} from "@/lib/reservations/reservation-table-assignment";

export type AutoAssignReservation = {
  id: string;
  party_size: number;
  starts_at: string;
  ends_at: string;
  dining_table_id: string | null;
  reservation_statuses: Pick<
    NonNullable<ReservationListRow["reservation_statuses"]>,
    "code"
  > | null;
};

export function toAutoAssignReservation(
  r: Pick<
    ReservationListRow,
    | "id"
    | "party_size"
    | "starts_at"
    | "ends_at"
    | "dining_table_id"
    | "reservation_statuses"
  >,
): AutoAssignReservation {
  return {
    id: r.id,
    party_size: r.party_size,
    starts_at: r.starts_at,
    ends_at: r.ends_at,
    dining_table_id: r.dining_table_id,
    reservation_statuses: r.reservation_statuses,
  };
}

function knownRowsForCheck(
  reservations: AutoAssignReservation[],
  planned: Map<string, string | null>,
): ReservationListRow[] {
  return reservations
    .filter((r) => reservationContributesToTableOccupancy(r.reservation_statuses))
    .map(
      (r) =>
        ({
          id: r.id,
          party_size: r.party_size,
          starts_at: r.starts_at,
          ends_at: r.ends_at,
          dining_table_id: planned.has(r.id)
            ? planned.get(r.id) ?? null
            : r.dining_table_id,
          reservation_statuses: r.reservation_statuses,
        }) as ReservationListRow,
    );
}

export type AutoTableAssignmentPreview = {
  assignments: Map<string, string | null>;
  preservedCount: number;
  toAssignCount: number;
  unassignedEligibleCount: number;
};

/**
 * Verteilt bestätigte Reservierungen ohne Tisch auf freie Plätze.
 * Bestehende Zuordnungen (bestätigt/am Tisch) bleiben unverändert.
 */
export function previewAutoTableAssignments(
  reservations: AutoAssignReservation[],
  tables: DiningTableRow[],
): AutoTableAssignmentPreview {
  const activeTables = tables.filter((t) => t.is_active !== false);
  const planned = new Map<string, string | null>();
  const result = new Map<string, string | null>();

  const eligible = reservations
    .filter((r) => isConfirmedReservationStatus(r.reservation_statuses))
    .sort((a, b) => {
      const dt =
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
      if (dt !== 0) return dt;
      return b.party_size - a.party_size;
    });

  let preservedCount = 0;
  for (const r of reservations) {
    if (
      reservationContributesToTableOccupancy(r.reservation_statuses) &&
      r.dining_table_id
    ) {
      planned.set(r.id, r.dining_table_id);
      if (isConfirmedReservationStatus(r.reservation_statuses)) {
        preservedCount += 1;
      }
    }
  }

  const unassigned = eligible.filter((r) => !r.dining_table_id);

  for (const r of unassigned) {
    let bestTableId: string | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const table of activeTables) {
      const check = checkTableAssignmentForSave({
        tableId: table.id,
        partySize: r.party_size,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        excludeReservationId: r.id,
        tables: activeTables,
        knownReservations: knownRowsForCheck(reservations, planned),
      });

      if (check.kind === "capacity_exceeded") continue;

      const cap = Math.max(0, table.capacity);
      let score: number;
      if (check.kind === "confirm_share") {
        score =
          2000 +
          check.seatUsed * 20 -
          Math.max(0, check.remaining - r.party_size);
      } else {
        score = 1000 - (cap - r.party_size);
      }

      if (score > bestScore) {
        bestScore = score;
        bestTableId = table.id;
      }
    }

    planned.set(r.id, bestTableId);
    if (bestTableId) {
      result.set(r.id, bestTableId);
    }
  }

  return {
    assignments: result,
    preservedCount,
    toAssignCount: result.size,
    unassignedEligibleCount: unassigned.length,
  };
}

export function computeAutoTableAssignments(
  reservations: AutoAssignReservation[],
  tables: DiningTableRow[],
): Map<string, string | null> {
  return previewAutoTableAssignments(reservations, tables).assignments;
}

export function summarizeAutoTableAssignments(
  assignments: Map<string, string | null>,
  tables: DiningTableRow[],
): { assigned: number; unchanged: number; labels: string[] } {
  const labels: string[] = [];
  for (const tableId of assignments.values()) {
    if (!tableId) continue;
    const t = tables.find((x) => x.id === tableId);
    if (t) labels.push(formatDiningTableLabel(t));
  }
  return {
    assigned: assignments.size,
    unchanged: 0,
    labels,
  };
}
