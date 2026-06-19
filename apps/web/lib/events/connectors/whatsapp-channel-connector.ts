import "server-only";

import type { EventsPlatformConnector } from "@/lib/events/connectors/types";
import { buildEventAnnouncementBody } from "@/lib/events/format-events-display-date";
import { wahaSendText } from "@/lib/whatsapp/waha-send-text";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const CAPABILITIES = {
  canReadFeed: false,
  canCreateEvent: true,
  canUpdateEvent: false,
  canDeleteEvent: false,
  isAnnouncementOnly: true,
  maxCoverCount: 0,
} as const;

function normalizeChannelIds(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

async function resolveChannelIds(
  restaurantId: string,
  sb: import("@supabase/supabase-js").SupabaseClient,
): Promise<string[]> {
  const { data } = await sb
    .from("restaurant_events_settings")
    .select("whatsapp_channel_ids")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  return normalizeChannelIds(data?.whatsapp_channel_ids);
}

export const whatsappChannelEventsAnnouncementConnector: EventsPlatformConnector = {
  key: "whatsapp_channel",
  displayName: "WhatsApp Kanal",
  capabilities: CAPABILITIES,
  async isConnected(restaurantId) {
    const admin = createSupabaseAdminClient();
    if (!admin) return false;
    const { data } = await admin
      .from("restaurant_integrations")
      .select("status")
      .eq("restaurant_id", restaurantId)
      .eq("integration_key", "whatsapp")
      .maybeSingle();
    return data?.status === "working";
  },
  async fetchFeed() {
    return { items: [] };
  },
  async publishEvent(restaurantId, sb, input) {
    const channelIds = await resolveChannelIds(restaurantId, sb);
    const channelId = channelIds[0];
    if (!channelId) return { ok: false, error: "whatsapp_channel_not_configured" };
    const text = buildEventAnnouncementBody({
      title: input.title,
      description: input.description,
      startAt: input.startAt,
      endAt: input.endAt,
      ticketUrl: input.ticketUrl,
      location: input.location,
    });
    const sent = await wahaSendText({
      restaurantId,
      chatId: channelId,
      text,
    });
    if (!sent.ok) return { ok: false, error: sent.error };
    return {
      ok: true,
      externalId: null,
      externalUrl: null,
      publishedAt: new Date().toISOString(),
    };
  },
  externalEditUrl() {
    return "https://web.whatsapp.com/";
  },
};
