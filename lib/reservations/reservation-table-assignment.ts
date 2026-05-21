import { formatDiningTableLabel } from "@/lib/supabase/dining-floor-db";
import type {
  ReservationListRow,
  ReservationStatusJoin,
} from "@/lib/supabase/reservations-db";

export const RESERVATION_STATUS_CONFIRMED = "confirmed" as const;

export function isConfirmedReservationStatus(
  status: Pick<ReservationStatusJoin, "code"> | null | undefined,
): boolean {
  return status?.code === RESERVATION_STATUS_CONFIRMED;
}

/** Tisch-Badge/Label nur bei Status „Bestätigt“. */
export function reservationDiningTableLabel(
  r: Pick<
    ReservationListRow,
    "dining_tables" | "dining_table_id" | "reservation_statuses"
  >,
): string | null {
  if (!isConfirmedReservationStatus(r.reservation_statuses)) return null;
  return reservationAssignedTableLabel(r);
}

/** Tisch-Label wenn ein Tisch zugewiesen ist (z. B. Gridansicht). */
export function reservationAssignedTableLabel(
  r: Pick<ReservationListRow, "dining_tables" | "dining_table_id">,
): string | null {
  if (!r.dining_table_id || !r.dining_tables) return null;
  return formatDiningTableLabel(r.dining_tables);
}

export function reservationAllowsTableAssignment(
  statusId: string,
  statuses: ReservationStatusJoin[],
): boolean {
  if (!statusId) return false;
  const st = statuses.find((s) => s.id === statusId);
  return isConfirmedReservationStatus(st);
}
