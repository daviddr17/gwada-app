import type { RestaurantReservationLogEntry } from "@/lib/types/reservation-log";

/** Display-Client: Protokoll über Display-Session-API (kein Browser-Supabase-RLS). */
export async function fetchDisplayReservationProtocolEntries(
  _restaurantId: string,
  reservationId: string,
): Promise<{ data: RestaurantReservationLogEntry[]; error: string | null }> {
  try {
    const res = await fetch(
      `/api/display/reservations/${encodeURIComponent(reservationId)}/protocol`,
      { cache: "no-store", credentials: "include" },
    );
    const body = (await res.json()) as {
      entries?: RestaurantReservationLogEntry[];
      error?: string;
    };
    if (!res.ok) {
      return {
        data: [],
        error: body.error ?? `protocol_http_${res.status}`,
      };
    }
    return { data: body.entries ?? [], error: null };
  } catch {
    return { data: [], error: "protocol_fetch_failed" };
  }
}
