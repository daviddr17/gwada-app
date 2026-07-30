import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";
import { wahaEditMessage } from "@/lib/waha/waha-edit-message";
import type { SupabaseClient } from "@supabase/supabase-js";

const WAHA_SEND_MIRROR_WINDOW_MS = 3 * 60 * 1000;

export async function editWahaMessageServer(params: {
  restaurantId: string;
  chatId: string;
  messageId: string;
  text: string;
  contactId?: string | null;
  /** Vorheriger Bubble-Text — Send-Spiegel ohne `waha:`-ID treffen. */
  previousText?: string | null;
  admin?: SupabaseClient | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = await getWahaServerConfigForRestaurantAdmin(params.restaurantId);
  if (!config) {
    return { ok: false, error: "waha_not_configured" };
  }

  const chatId = params.chatId.trim();
  const messageId = params.messageId.trim();
  const text = params.text.trim();
  if (!chatId || !messageId || !text) {
    return { ok: false, error: "invalid_request" };
  }

  const wahaResult = await wahaEditMessage({
    config,
    restaurantId: params.restaurantId,
    chatId,
    messageId,
    text,
  });
  if (!wahaResult.ok) return wahaResult;

  if (params.admin) {
    const admin = params.admin;
    const externalSourceId = `waha:${messageId}`;

    await admin
      .from("contact_messages")
      .update({ body: text })
      .eq("restaurant_id", params.restaurantId)
      .eq("external_source_id", externalSourceId);

    const contactId = params.contactId?.trim();
    const previousText = params.previousText?.trim();
    if (contactId) {
      if (previousText) {
        await admin
          .from("contact_messages")
          .update({ body: text })
          .eq("restaurant_id", params.restaurantId)
          .eq("contact_id", contactId)
          .eq("platform", "whatsapp")
          .eq("direction", "outbound")
          .is("external_source_id", null)
          .eq("body", previousText);
      }

      const { data: anchor } = await admin
        .from("contact_messages")
        .select("created_at")
        .eq("restaurant_id", params.restaurantId)
        .eq("contact_id", contactId)
        .eq("external_source_id", externalSourceId)
        .maybeSingle();

      const anchorAt = (anchor as { created_at?: string } | null)?.created_at;
      if (anchorAt) {
        const t = Date.parse(anchorAt);
        if (Number.isFinite(t)) {
          const windowStart = new Date(
            t - WAHA_SEND_MIRROR_WINDOW_MS,
          ).toISOString();
          const windowEnd = new Date(
            t + WAHA_SEND_MIRROR_WINDOW_MS,
          ).toISOString();
          await admin
            .from("contact_messages")
            .update({ body: text })
            .eq("restaurant_id", params.restaurantId)
            .eq("contact_id", contactId)
            .eq("platform", "whatsapp")
            .eq("direction", "outbound")
            .is("external_source_id", null)
            .gte("created_at", windowStart)
            .lte("created_at", windowEnd);
        }
      }
    }
  }

  return { ok: true };
}
