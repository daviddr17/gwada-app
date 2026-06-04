import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReservationLiveToastFields } from "@/lib/reservations/reservation-live-toast";

export type ReservationsLiveSignal = {
  latestCreatedAt: string | null;
  latest: ReservationLiveToastFields | null;
};

const LIVE_SIGNAL_SELECT =
  "created_at, starts_at, guest_first_name, guest_last_name, party_size";

function mapLiveSignalRow(
  data: Record<string, unknown> | null,
): ReservationsLiveSignal {
  if (!data) return { latestCreatedAt: null, latest: null };
  const createdAt = (data.created_at as string) ?? null;
  const partyRaw = data.party_size;
  const partySize =
    typeof partyRaw === "number"
      ? partyRaw
      : typeof partyRaw === "string"
        ? Number.parseInt(partyRaw, 10)
        : 0;
  return {
    latestCreatedAt: createdAt,
    latest:
      typeof data.starts_at === "string"
        ? {
            starts_at: data.starts_at,
            guest_first_name:
              typeof data.guest_first_name === "string"
                ? data.guest_first_name
                : null,
            guest_last_name:
              typeof data.guest_last_name === "string"
                ? data.guest_last_name
                : null,
            party_size:
              Number.isFinite(partySize) && partySize > 0 ? partySize : 1,
          }
        : null,
  };
}

/** Neueste Reservierung für Live-Polling (RLS-geschützt). */
export async function fetchReservationsLiveSignal(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<ReservationsLiveSignal> {
  const { data, error } = await sb
    .from("reservations")
    .select(LIVE_SIGNAL_SELECT)
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return { latestCreatedAt: null, latest: null };
  return mapLiveSignalRow(data as Record<string, unknown>);
}
