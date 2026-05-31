import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { RESERVATION_STATUS_EMBED } from "@/lib/supabase/reservations-db";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type ReservationAnalyticsRow = {
  id: string;
  created_at: string;
  starts_at: string;
  party_size: number;
  reservation_statuses: {
    code: string;
    name: string;
    color_hex: string;
  } | null;
};

const ANALYTICS_SELECT = `
  id,
  created_at,
  starts_at,
  party_size,
  ${RESERVATION_STATUS_EMBED} ( code, name, color_hex )
`;

export async function fetchReservationsForAnalytics(params: {
  restaurantId: string;
  /** Monate zurück ab jetzt (Standard 12). */
  monthsBack?: number;
}): Promise<{ data: ReservationAnalyticsRow[]; error: Error | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { data: [], error: null };
  }
  const months = params.monthsBack ?? 12;
  const start = new Date();
  start.setMonth(start.getMonth() - months);
  start.setHours(0, 0, 0, 0);

  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("reservations")
    .select(ANALYTICS_SELECT)
    .eq("restaurant_id", params.restaurantId)
    .gte("starts_at", start.toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    return { data: [], error: new Error(error.message) };
  }

  const rows = (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const st = row.reservation_statuses;
    const status = Array.isArray(st) ? (st[0] ?? null) : st;
    return {
      id: row.id as string,
      created_at: row.created_at as string,
      starts_at: row.starts_at as string,
      party_size: row.party_size as number,
      reservation_statuses: status as ReservationAnalyticsRow["reservation_statuses"],
    };
  });

  return { data: rows, error: null };
}
