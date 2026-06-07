import type {
  RestaurantIntegrationKey,
  RestaurantWhatsappIntegrationRow,
  RestaurantWhatsappStatus,
  WahaSessionStatus,
} from "@/lib/types/restaurant-integration";
import { mapWahaStatusToIntegration } from "@/lib/waha/waha-client";
import type { WahaSessionPayload } from "@/lib/waha/waha-client";
import { wahaSessionNameForRestaurant } from "@/lib/waha/waha-session-name";
import type { SupabaseClient } from "@supabase/supabase-js";

const WHATSAPP_KEY: RestaurantIntegrationKey = "whatsapp";

export async function fetchRestaurantWhatsappIntegration(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantWhatsappIntegrationRow | null> {
  const { data, error } = await sb
    .from("restaurant_integrations")
    .select(
      "restaurant_id, integration_key, waha_session_name, status, phone_number, display_name, connected_at, last_error, updated_at",
    )
    .eq("restaurant_id", restaurantId)
    .eq("integration_key", WHATSAPP_KEY)
    .maybeSingle();

  if (error) {
    console.warn("fetchRestaurantWhatsappIntegration", error.message);
    return null;
  }
  return (data as RestaurantWhatsappIntegrationRow | null) ?? null;
}

export async function upsertRestaurantWhatsappIntegration(
  sb: SupabaseClient,
  restaurantId: string,
  patch: {
    status: RestaurantWhatsappStatus;
    phone_number?: string | null;
    display_name?: string | null;
    connected_at?: string | null;
    last_error?: string | null;
  },
): Promise<{ error: string | null }> {
  const waha_session_name = wahaSessionNameForRestaurant(restaurantId);
  const { error } = await sb.from("restaurant_integrations").upsert(
    {
      restaurant_id: restaurantId,
      integration_key: WHATSAPP_KEY,
      waha_session_name,
      status: patch.status,
      phone_number: patch.phone_number ?? null,
      display_name: patch.display_name ?? null,
      connected_at: patch.connected_at ?? null,
      last_error: patch.last_error ?? null,
    },
    { onConflict: "restaurant_id,integration_key" },
  );
  return { error: error?.message ?? null };
}

export function integrationStateFromWahaSession(
  session: WahaSessionPayload | null | undefined,
  fallbackStatus: RestaurantWhatsappStatus = "disconnected",
): {
  status: RestaurantWhatsappStatus;
  phone_number: string | null;
  display_name: string | null;
  connected_at: string | null;
  wahaStatus: WahaSessionStatus | null;
} {
  if (!session?.status) {
    return {
      status: fallbackStatus,
      phone_number: null,
      display_name: null,
      connected_at: null,
      wahaStatus: null,
    };
  }

  const status = mapWahaStatusToIntegration(session.status);
  const me = session.me;
  const phone_number =
    typeof me?.id === "string" ? me.id.replace(/@c\.us$/, "") : null;
  const display_name =
    (typeof me?.pushName === "string" && me.pushName) ||
    (typeof me?.name === "string" && me.name) ||
    null;

  return {
    status,
    phone_number,
    display_name,
    connected_at: status === "working" ? new Date().toISOString() : null,
    wahaStatus: session.status,
  };
}
