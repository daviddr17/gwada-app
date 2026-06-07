import type { WahaConnectResponse } from "@/lib/types/restaurant-integration";
import type { RestaurantWhatsappStatus } from "@/lib/types/restaurant-integration";
import { fetchRestaurantWhatsappIntegration } from "@/lib/supabase/restaurant-integrations-db";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function buildWhatsappStatusResponse(
  sb: SupabaseClient,
  restaurantId: string,
  configured: boolean,
): Promise<WahaConnectResponse> {
  const row = await fetchRestaurantWhatsappIntegration(sb, restaurantId);
  const status: RestaurantWhatsappStatus = row?.status ?? "disconnected";

  const needsReconnect =
    status === "failed" ||
    status === "stopped" ||
    (status === "disconnected" && Boolean(row?.waha_session_name));

  return {
    configured,
    status,
    wahaStatus: null,
    phoneNumber: row?.phone_number ?? null,
    displayName: row?.display_name ?? null,
    needsQr: status === "scan_qr",
    needsReconnect,
    message: row?.last_error ?? undefined,
  };
}
