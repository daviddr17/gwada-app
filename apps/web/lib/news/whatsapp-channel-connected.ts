import "server-only";

import { assertPlatformWhatsappEnabled } from "@/lib/integrations/platform-messaging-guard";
import { resolveNewsWhatsappChannelIds } from "@/lib/news/resolve-whatsapp-channel-ids";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

/** WhatsApp-Kanal für News/Events: Plattform aktiv, Session working, Kanal-IDs hinterlegt. */
export async function isRestaurantWhatsappChannelConfigured(
  restaurantId: string,
  sb?: SupabaseClient,
): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;

  const waPlatform = await assertPlatformWhatsappEnabled(admin);
  if (!waPlatform.ok) return false;

  const { data } = await admin
    .from("restaurant_integrations")
    .select("status")
    .eq("restaurant_id", restaurantId)
    .eq("integration_key", "whatsapp")
    .maybeSingle();
  if (data?.status !== "working") return false;

  const client = sb ?? admin;
  const channelIds = await resolveNewsWhatsappChannelIds(restaurantId, client, null);
  return channelIds.length > 0;
}
