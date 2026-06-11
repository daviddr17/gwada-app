import "server-only";

import type { NewsPlatformConnector } from "@/lib/news/connectors/types";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import {
  fetchWahaChannelMessages,
  listWahaChannelsForRestaurant,
} from "@/lib/waha/waha-channels";
import { wahaSendText } from "@/lib/whatsapp/waha-send-text";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const CAPABILITIES = {
  canReadFeed: true,
  canCreatePost: true,
  canUpdatePost: false,
  canDeletePost: false,
  canReadInsights: false,
  supportsNativeScheduling: false,
  supportsVideo: true,
  maxMediaCount: 1,
} as const;

async function resolveChannelId(
  restaurantId: string,
  sb: import("@supabase/supabase-js").SupabaseClient,
  override?: string | null,
): Promise<string | null> {
  if (override?.includes("@newsletter")) return override;
  const { data } = await sb
    .from("restaurant_news_settings")
    .select("whatsapp_channel_id")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  const fromSettings = (data?.whatsapp_channel_id as string | null)?.trim();
  if (fromSettings) return fromSettings;
  const list = await listWahaChannelsForRestaurant(restaurantId, { role: "OWNER" });
  if ("error" in list) return null;
  return list.channels[0]?.id ?? null;
}

export const whatsappChannelNewsConnector: NewsPlatformConnector = {
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
  async fetchFeed(restaurantId, sb) {
    const channelId = await resolveChannelId(restaurantId, sb, null);
    if (!channelId) return { error: "whatsapp_channel_not_configured" };
    const messages = await fetchWahaChannelMessages(restaurantId, channelId, {
      limit: 50,
    });
    if ("error" in messages) return { error: messages.error };
    const items: UnifiedNewsItem[] = (messages.messages ?? [])
      .filter((m) => m.body?.trim())
      .map((m) => ({
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
      }));
    return { items };
  },
  async publishPost(restaurantId, sb, input) {
    const channelId = await resolveChannelId(
      restaurantId,
      sb,
      typeof input.platformConfig?.channelId === "string"
        ? input.platformConfig.channelId
        : null,
    );
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
