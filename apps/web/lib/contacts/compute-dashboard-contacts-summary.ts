import type { ContactListRow } from "@/lib/supabase/contacts-db";

export type DashboardContactsSummary = {
  total: number;
  withReservation: number;
  withCompany: number;
};

export function computeDashboardContactsSummary(
  rows: ContactListRow[],
): DashboardContactsSummary {
  let withReservation = 0;
  let withCompany = 0;
  for (const row of rows) {
    if ((row.reservation_count ?? 0) > 0) withReservation += 1;
    if (row.company?.trim()) withCompany += 1;
  }
  return {
    total: rows.length,
    withReservation,
    withCompany,
  };
}
