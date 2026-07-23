import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";
import { wahaDeleteMessage } from "@/lib/waha/waha-delete-message";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function deleteWahaMessageServer(params: {
  restaurantId: string;
  chatId: string;
  messageId: string;
  admin?: SupabaseClient | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = await getWahaServerConfigForRestaurantAdmin(params.restaurantId);
  if (!config) {
    return { ok: false, error: "waha_not_configured" };
  }

  const chatId = params.chatId.trim();
  const messageId = params.messageId.trim();
  if (!chatId || !messageId) {
    return { ok: false, error: "invalid_request" };
  }

  const wahaResult = await wahaDeleteMessage({
    config,
    restaurantId: params.restaurantId,
    chatId,
    messageId,
  });
  if (!wahaResult.ok) return wahaResult;

  if (params.admin) {
    await params.admin
      .from("contact_messages")
      .delete()
      .eq("restaurant_id", params.restaurantId)
      .eq("external_source_id", `waha:${messageId}`);
  }

  return { ok: true };
}
