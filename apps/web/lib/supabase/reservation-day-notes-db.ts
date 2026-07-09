import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { fetchProfileDisplayNamesByIds } from "@/lib/supabase/documents-db";
import type { RestaurantReservationDayNoteEntry } from "@/lib/types/reservation-day-notes";

const ENTRY_SELECT =
  "id, restaurant_id, service_date, employee_id, actor_user_id, body, created_at, updated_at";

function mapEntry(
  row: Record<string, unknown>,
  nameByUserId: Map<string, string>,
): RestaurantReservationDayNoteEntry {
  const actorUserId = row.actor_user_id as string;
  return {
    id: row.id as string,
    restaurant_id: row.restaurant_id as string,
    service_date: row.service_date as string,
    employee_id: (row.employee_id as string | null) ?? null,
    actor_user_id: actorUserId,
    body: row.body as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    actor_label: nameByUserId.get(actorUserId) ?? "—",
  };
}

export async function fetchReservationDayNoteEntries(
  restaurantId: string,
  serviceDate: string,
): Promise<{ data: RestaurantReservationDayNoteEntry[]; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_reservation_day_note_entries")
    .select(ENTRY_SELECT)
    .eq("restaurant_id", restaurantId)
    .eq("service_date", serviceDate)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return { data: [], error: error.message };

  const actorIds = (data ?? []).map((r) => r.actor_user_id as string);
  const nameByUserId = await fetchProfileDisplayNamesByIds(actorIds);

  return {
    data: (data ?? []).map((r) =>
      mapEntry(r as Record<string, unknown>, nameByUserId),
    ),
    error: null,
  };
}

export async function fetchReservationDayNoteCountsForRange(
  restaurantId: string,
  startYmd: string,
  endYmd: string,
): Promise<{ data: Map<string, number>; error: string | null }> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("restaurant_reservation_day_note_entries")
    .select("service_date")
    .eq("restaurant_id", restaurantId)
    .gte("service_date", startYmd)
    .lte("service_date", endYmd);

  if (error) return { data: new Map(), error: error.message };

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const key = row.service_date as string;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return { data: counts, error: null };
}
