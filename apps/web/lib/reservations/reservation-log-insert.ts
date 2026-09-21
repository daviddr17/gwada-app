import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ReservationLogAction,
  ReservationLogDetails,
} from "@/lib/types/reservation-log";

/** Shared Server/Browser: nur DB-Insert (kein Live-Verlauf / kein window). */
export async function insertReservationLogEntry(
  supabase: SupabaseClient,
  params: {
    restaurantId: string;
    reservationId: string | null;
    actorUserId?: string | null;
    action: ReservationLogAction;
    reservationNumber: number | null;
    guestLabel: string;
    details?: ReservationLogDetails;
  },
): Promise<{ id: string | null; createdAt: string | null }> {
  const details: ReservationLogDetails = params.details ?? {};

  const { data, error } = await supabase
    .from("restaurant_reservation_log_entries")
    .insert({
      restaurant_id: params.restaurantId,
      reservation_id: params.reservationId,
      actor_user_id: params.actorUserId ?? null,
      action: params.action,
      reservation_number: params.reservationNumber,
      guest_label: params.guestLabel.trim(),
      details,
    })
    .select("id, created_at")
    .maybeSingle();

  if (error) {
    console.warn("[gwada] restaurant_reservation_log_entries", error.message);
    return { id: null, createdAt: null };
  }

  return {
    id: typeof data?.id === "string" ? data.id : null,
    createdAt: typeof data?.created_at === "string" ? data.created_at : null,
  };
}
