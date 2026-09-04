import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { wahaGetChatMessages } from "@/lib/waha/waha-inbox";
import { getWahaServerConfigForRestaurantAdmin } from "@/lib/waha/waha-config";
import {
  findMatchingFromMeWahaMessage,
  type WahaOutboundEvidence,
} from "@/lib/whatsapp/reconcile-waha-outbound-send";

const WAHA_PREFIX = "waha:";

export async function findReservationWhatsappSendEvidence(params: {
  sb: SupabaseClient;
  restaurantId: string;
  reservationId: string;
  chatId: string;
  body: string;
  sinceMs: number;
}): Promise<WahaOutboundEvidence> {
  const fromInbox = await findWahaIdInContactMessages(params);
  if (fromInbox) {
    return {
      status: "confirmed",
      wahaMessageId: fromInbox,
      source: "contact_messages",
    };
  }

  const config = await getWahaServerConfigForRestaurantAdmin(params.restaurantId);
  if (!config) {
    return { status: "unknown", reason: "waha_not_configured" };
  }

  const history = await wahaGetChatMessages({
    config,
    restaurantId: params.restaurantId,
    chatId: params.chatId,
    limit: 40,
    downloadMedia: false,
  });
  if (!history.ok) {
    return { status: "unknown", reason: history.error };
  }

  const match = findMatchingFromMeWahaMessage(
    history.data,
    params.body,
    params.sinceMs,
  );
  if (match) {
    return {
      status: "confirmed",
      wahaMessageId: match.id,
      source: "waha_history",
    };
  }

  return { status: "absent" };
}

async function findWahaIdInContactMessages(params: {
  sb: SupabaseClient;
  restaurantId: string;
  reservationId: string;
}): Promise<string | null> {
  const { data, error } = await params.sb
    .from("contact_messages")
    .select("external_source_id")
    .eq("restaurant_id", params.restaurantId)
    .eq("reservation_id", params.reservationId)
    .eq("platform", "whatsapp")
    .eq("direction", "outbound")
    .like("external_source_id", `${WAHA_PREFIX}%`)
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) return null;

  for (const row of data ?? []) {
    const raw = String(
      (row as { external_source_id?: string }).external_source_id ?? "",
    );
    if (raw.startsWith(WAHA_PREFIX) && raw.length > WAHA_PREFIX.length) {
      return raw.slice(WAHA_PREFIX.length);
    }
  }
  return null;
}
