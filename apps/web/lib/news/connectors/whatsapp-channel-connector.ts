import "server-only";

import type { NewsPlatformConnector } from "@/lib/news/connectors/types";
import { resolveNewsWhatsappChannelIds } from "@/lib/news/resolve-whatsapp-channel-ids";
import { isRestaurantWhatsappChannelConfigured } from "@/lib/news/whatsapp-channel-connected";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import { fetchWahaChannelMessages } from "@/lib/waha/waha-channels";
import { wahaSendText } from "@/lib/whatsapp/waha-send-text";

const CAPABILITIES = {
  canReadFeed: true,
  canReadStories: false,
  canCreatePost: true,
  canPublishStory: false,
  canUpdatePost: false,
  canDeletePost: false,
  canReadInsights: false,
  supportsNativeScheduling: false,
  supportsVideo: true,
  maxMediaCount: 1,
} as const;

export const whatsappChannelNewsConnector: NewsPlatformConnector = {
  key: "whatsapp_channel",
  displayName: "WhatsApp Kanal",
  capabilities: CAPABILITIES,
  async isConnected(restaurantId) {
    return isRestaurantWhatsappChannelConfigured(restaurantId);
  },
  async fetchFeed(restaurantId, sb) {
    const channelIds = await resolveNewsWhatsappChannelIds(restaurantId, sb, null);
    if (channelIds.length === 0) return { error: "whatsapp_channel_not_configured" };

    const batches = await Promise.all(
      channelIds.map((channelId) =>
        fetchWahaChannelMessages(restaurantId, channelId, { limit: 50 }),
      ),
    );

    const items: UnifiedNewsItem[] = [];
    for (let index = 0; index < channelIds.length; index++) {
      const channelId = channelIds[index]!;
      const messages = batches[index];
      if (!messages || "error" in messages) continue;
      for (const m of messages.messages ?? []) {
        if (!m.body?.trim()) continue;
        items.push({
          id: `whatsapp_channel:${m.id ?? `${channelId}:${m.timestamp}`}`,
          platform: "whatsapp_channel",
          source: "external",
          postId: null,
          title: null,
          body: m.body?.trim() ?? "",
          media:
            m.hasMedia && m.media?.url
              ? [
                  {
                    id: m.id ?? "media",
                    kind: (m.media.mimetype ?? "").startsWith("video/")
                      ? "video"
                      : "image",
                    url: m.media.url,
                    storagePath: null,
                    mimeType: m.media.mimetype ?? null,
                    sortOrder: 0,
                  },
                ]
              : [],
          createdAt: m.timestamp
            ? new Date(m.timestamp * 1000).toISOString()
            : new Date().toISOString(),
          publishedAt: m.timestamp
            ? new Date(m.timestamp * 1000).toISOString()
            : new Date().toISOString(),
          scheduledAt: null,
          status: "published",
          canEdit: false,
          canDelete: false,
          externalUrl: null,
          insights: null,
          authorName: null,
        });
      }
    }

    items.sort(
      (a, b) =>
        new Date(b.publishedAt ?? b.createdAt).getTime() -
        new Date(a.publishedAt ?? a.createdAt).getTime(),
    );
    return { items };
  },
  async publishPost(restaurantId, sb, input) {
    const override =
      typeof input.platformConfig?.channelId === "string"
        ? input.platformConfig.channelId
        : null;
    const channelIds = await resolveNewsWhatsappChannelIds(restaurantId, sb, override);
    const channelId = channelIds[0];
    if (!channelId) return { ok: false, error: "whatsapp_channel_not_configured" };
    const text = [input.title?.trim(), input.body.trim()].filter(Boolean).join("\n\n");
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
