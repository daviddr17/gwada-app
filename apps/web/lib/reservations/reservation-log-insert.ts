import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ReservationLogAction,
  ReservationLogDetails,
} from "@/lib/types/reservation-log";
import { resolveReservationLogActorNames } from "@/lib/reservations/reservation-log-actor-resolve";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

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
): Promise<void> {
  const details: ReservationLogDetails = params.details ?? {};

  const { error } = await supabase
    .from("restaurant_reservation_log_entries")
    .insert({
      restaurant_id: params.restaurantId,
      reservation_id: params.reservationId,
      actor_user_id: params.actorUserId ?? null,
      action: params.action,
      reservation_number: params.reservationNumber,
      guest_label: params.guestLabel.trim(),
      details,
    });

  if (error) {
    console.warn("[gwada] restaurant_reservation_log_entries", error.message);
  }
}

export async function insertReservationLogFromBrowser(params: {
  restaurantId: string;
  reservationId: string | null;
  action: ReservationLogAction;
  reservationNumber: number | null;
  guestLabel: string;
  details?: ReservationLogDetails;
}): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let details = params.details ?? { actorSource: "staff" as const };
  if (user && details.actorSource !== "guest" && details.actorSource !== "display") {
    const hasName = Boolean(
      details.actorGivenName?.trim() || details.actorFamilyName?.trim(),
    );
    if (!hasName) {
      const actor = await resolveReservationLogActorNames(supabase, {
        restaurantId: params.restaurantId,
        actorUserId: user.id,
      });
      if (actor) {
        details = {
          ...details,
          actorGivenName: actor.actorGivenName,
          actorFamilyName: actor.actorFamilyName,
          actorSource: details.actorSource ?? "staff",
        };
      }
    } else {
      details = {
        ...details,
        actorSource: details.actorSource ?? "staff",
      };
    }
  }

  await insertReservationLogEntry(supabase, {
    ...params,
    actorUserId: user?.id ?? null,
    details,
  });
}
