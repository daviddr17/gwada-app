import "server-only";

import { computeDashboardReservationSummary } from "@/lib/reservations/compute-dashboard-reservation-summary";
import type { DashboardReservationSummary } from "@/lib/reservations/compute-dashboard-reservation-summary";
import {
  restaurantFromTodayUtcIsoRange,
  restaurantWeekRangeUtcIso,
} from "@/lib/reservations/dashboard-period-range";
import { normalizeReservationKind } from "@/lib/reservations/reservation-kind";
import { fetchRestaurantTimezoneServer } from "@/lib/supabase/restaurant-timezone-server";
import {
  RESERVATION_STATUS_EMBED,
  type ReservationListRow,
  type ReservationStatusJoin,
} from "@/lib/supabase/reservations-db";
import type { SupabaseClient } from "@supabase/supabase-js";

/** KPI/Sheets brauchen nur Status + Gast + Party — kein List-Overfetch. */
const DASHBOARD_RESERVATION_KPI_SELECT = `
  id,
  kind,
  guest_first_name,
  guest_last_name,
  party_size,
  starts_at,
  ${RESERVATION_STATUS_EMBED} ( id, code, name, color_hex )
`;

function mapDashboardReservationKpiRow(
  row: Record<string, unknown>,
): ReservationListRow {
  const st = row.reservation_statuses;
  const status = Array.isArray(st) ? (st[0] ?? null) : st;
  return {
    id: row.id as string,
    restaurant_id: "",
    reservation_number: 0,
    guest_pin: "",
    created_at: "",
    created_by_profile_id: null,
    created_by_profile: null,
    kind: normalizeReservationKind(row.kind),
    guest_first_name: (row.guest_first_name as string) ?? "",
    guest_last_name: (row.guest_last_name as string) ?? "",
    guest_company: null,
    guest_phone: null,
    guest_email: null,
    contact_id: null,
    party_size: Number(row.party_size) || 0,
    starts_at: row.starts_at as string,
    ends_at: "",
    dwell_minutes: null,
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
    reservation_statuses: status as ReservationStatusJoin | null,
    dining_tables: null,
    assigned_staff: [],
    accounting_quotation: null,
    accounting_invoice: null,
  };
}

async function fetchReservationsRangeServer(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    rangeStartIso: string;
    rangeEndExclusiveIso: string;
  },
) {
  const { data, error } = await sb
    .from("reservations")
    .select(DASHBOARD_RESERVATION_KPI_SELECT)
    .eq("restaurant_id", params.restaurantId)
    .gte("starts_at", params.rangeStartIso)
    .lt("starts_at", params.rangeEndExclusiveIso)
    .order("starts_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) =>
    mapDashboardReservationKpiRow(row as Record<string, unknown>),
  );
}

export async function loadDashboardReservationSummaryServer(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<DashboardReservationSummary> {
  const timeZone = await fetchRestaurantTimezoneServer(sb, restaurantId);
  const week = restaurantWeekRangeUtcIso(timeZone);
  const upcoming = restaurantFromTodayUtcIsoRange(timeZone);

  const [weekRows, upcomingRows] = await Promise.all([
    fetchReservationsRangeServer(sb, {
      restaurantId,
      rangeStartIso: week.rangeStartIso,
      rangeEndExclusiveIso: week.rangeEndExclusiveIso,
    }),
    fetchReservationsRangeServer(sb, {
      restaurantId,
      rangeStartIso: upcoming.rangeStartIso,
      rangeEndExclusiveIso: upcoming.rangeEndExclusiveIso,
    }),
  ]);

  return computeDashboardReservationSummary(weekRows, upcomingRows, timeZone);
}
