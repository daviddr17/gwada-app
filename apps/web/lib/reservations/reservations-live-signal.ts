import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReservationLiveToastFields } from "@/lib/reservations/reservation-live-toast";

export type ReservationsLiveSignal = {
  latestCreatedAt: string | null;
  /** Für Own-Create-Toast-Suppress (Dashboard-Polling). */
  latestId: string | null;
  latest: ReservationLiveToastFields | null;
  /** Rohdaten für LIVE_INSERT-Patch (Polling ohne Realtime-Payload). */
  latestRaw: Record<string, unknown> | null;
};

const LIVE_SIGNAL_SELECT =
  "id, created_at, starts_at, ends_at, dwell_minutes, guest_first_name, guest_last_name, guest_company, party_size, status_id, created_by_profile_id, reservation_statuses ( id, code, name, color_hex )";

function mapLiveSignalRow(
  data: Record<string, unknown> | null,
): ReservationsLiveSignal {
  if (!data) {
    return {
      latestCreatedAt: null,
      latestId: null,
      latest: null,
      latestRaw: null,
    };
  }
  const createdAt = (data.created_at as string) ?? null;
  const latestId = typeof data.id === "string" ? data.id : null;
  const partyRaw = data.party_size;
  const partySize =
    typeof partyRaw === "number"
      ? partyRaw
      : typeof partyRaw === "string"
        ? Number.parseInt(partyRaw, 10)
        : 0;
  const latest: ReservationLiveToastFields | null =
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
      : null;
  return {
    latestCreatedAt: createdAt,
    latestId,
    latest,
    latestRaw: latestId && latest ? { ...data } : null,
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

  if (error || !data) {
    return {
      latestCreatedAt: null,
      latestId: null,
      latest: null,
      latestRaw: null,
    };
  }
  return mapLiveSignalRow(data as Record<string, unknown>);
}
