import type { SupabaseClient } from "@supabase/supabase-js";
import { enrichReservationLogActorNames } from "@/lib/reservations/reservation-log-actor-resolve";
import type { RestaurantReservationLogEntry } from "@/lib/types/reservation-log";

const LOG_SELECT =
  "id, restaurant_id, reservation_id, actor_user_id, action, reservation_number, guest_label, details, created_at";

function mapLogRow(r: Record<string, unknown>): RestaurantReservationLogEntry {
  return {
    id: r.id as string,
    restaurant_id: r.restaurant_id as string,
    reservation_id: (r.reservation_id as string | null) ?? null,
    actor_user_id: (r.actor_user_id as string | null) ?? null,
    action: r.action as RestaurantReservationLogEntry["action"],
    reservation_number: (r.reservation_number as number | null) ?? null,
    guest_label: r.guest_label as string,
    details: (r.details as RestaurantReservationLogEntry["details"]) ?? {},
    created_at: r.created_at as string,
  };
}

/**
 * Display: Reservierungs-Protokoll (Anlage + Änderungen) via Service-Role.
 * Chronologisch aufsteigend — zuerst Angelegt, danach Edits.
 */
export async function loadDisplayReservationProtocol(
  admin: SupabaseClient,
  restaurantId: string,
  reservationId: string,
): Promise<
  | { entries: RestaurantReservationLogEntry[] }
  | { error: "not_found" | "load_failed" }
> {
  const { data: reservation, error: reservationError } = await admin
    .from("reservations")
    .select("id")
    .eq("id", reservationId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (reservationError) return { error: "load_failed" };
  if (!reservation) return { error: "not_found" };

  const { data, error } = await admin
    .from("restaurant_reservation_log_entries")
    .select(LOG_SELECT)
    .eq("restaurant_id", restaurantId)
    .eq("reservation_id", reservationId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return { error: "load_failed" };

  const entries = await enrichReservationLogActorNames(
    admin,
    ((data ?? []) as Record<string, unknown>[]).map(mapLogRow),
  );

  return { entries };
}
