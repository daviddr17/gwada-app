import assert from "node:assert/strict";
import { test } from "node:test";

import { computeDashboardReservationSummary } from "./compute-dashboard-reservation-summary.ts";
import type { ReservationListRow } from "../supabase/reservations-db.ts";

function row(
  partial: Partial<ReservationListRow> &
    Pick<ReservationListRow, "id" | "starts_at">,
): ReservationListRow {
  return {
    restaurant_id: "r",
    reservation_number: 1,
    guest_pin: "000000",
    created_at: partial.starts_at,
    created_by_profile_id: null,
    created_by_profile: null,
    kind: "guest",
    guest_first_name: "Ana",
    guest_last_name: "Klein",
    guest_company: null,
    guest_phone: null,
    guest_email: null,
    contact_id: null,
    party_size: 2,
    ends_at: partial.starts_at,
    dwell_minutes: 90,
    dining_table_id: null,
    quotation_id: null,
    invoice_id: null,
    notify_email: false,
    notify_whatsapp: false,
    terms_accepted: false,
    notes: null,
    pending_change: null,
    status_before_change_id: null,
    relocated_from_starts_at: null,
    relocated_from_ends_at: null,
    relocated_from_dining_table_id: null,
    reservation_statuses: {
      id: "s",
      code: "confirmed",
      name: "Bestätigt",
      color_hex: "#22c55e",
    },
    dining_tables: null,
    assigned_staff: [],
    accounting_quotation: null,
    accounting_invoice: null,
    ...partial,
  };
}

const now = new Date("2026-09-24T10:00:00.000Z");

test("anstehende Liste enthält die interne Notiz und wird nicht auf fünf gekürzt", () => {
  const upcoming = Array.from({ length: 6 }, (_, i) =>
    row({
      id: `up-${i}`,
      starts_at: new Date(now.getTime() + (i + 1) * 3_600_000).toISOString(),
      notes: i === 0 ? "Fensterplatz" : i === 1 ? "display-demo:seed" : null,
      guest_first_name: `Gast${i}`,
    }),
  );
  const summary = computeDashboardReservationSummary(
    upcoming,
    [],
    "Europe/Berlin",
    now,
  );
  assert.equal(summary.todayUpcomingList.length, 6);
  assert.equal(summary.todayUpcomingList[0]?.internalNote, "Fensterplatz");
  assert.equal(summary.todayUpcomingList[1]?.internalNote, null);
  assert.equal(summary.todayUpcomingReservations, 6);
});
