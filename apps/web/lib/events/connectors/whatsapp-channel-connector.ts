import "server-only";

import type { EventsPlatformConnector } from "@/lib/events/connectors/types";
import { buildEventAnnouncementBody } from "@/lib/events/format-events-display-date";
import { resolveNewsWhatsappChannelIds } from "@/lib/news/resolve-whatsapp-channel-ids";
import { isRestaurantWhatsappChannelConfigured } from "@/lib/news/whatsapp-channel-connected";
import { wahaSendText } from "@/lib/whatsapp/waha-send-text";

const CAPABILITIES = {
  canReadFeed: false,
  canCreateEvent: true,
  canUpdateEvent: false,
  canDeleteEvent: false,
  isAnnouncementOnly: true,
  maxCoverCount: 0,
} as const;

export const whatsappChannelEventsAnnouncementConnector: EventsPlatformConnector = {
  key: "whatsapp_channel",
  displayName: "WhatsApp Kanal",
  capabilities: CAPABILITIES,
  async isConnected(restaurantId) {
    return isRestaurantWhatsappChannelConfigured(restaurantId);
  },
  async fetchFeed() {
    return { items: [] };
  },
  async publishEvent(restaurantId, sb, input) {
    const channelIds = await resolveNewsWhatsappChannelIds(restaurantId, sb);
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
