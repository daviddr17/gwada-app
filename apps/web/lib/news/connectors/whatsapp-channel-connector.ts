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
  override?: string | null,
): Promise<string[]> {
  if (override?.includes("@newsletter")) return [override];
  const { data } = await sb
    .from("restaurant_news_settings")
    .select("whatsapp_channel_ids, whatsapp_channel_id")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  const fromArray = normalizeChannelIds(data?.whatsapp_channel_ids);
  if (fromArray.length > 0) return fromArray;

  const legacy = (data?.whatsapp_channel_id as string | null)?.trim();
  if (legacy) return [legacy];

  const list = await listWahaChannelsForRestaurant(restaurantId, { role: "OWNER" });
  if ("error" in list) return [];
  return list.channels.map((channel) => channel.id).filter(Boolean);
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
    const channelIds = await resolveChannelIds(restaurantId, sb, null);
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
    const channelIds = await resolveChannelIds(restaurantId, sb, override);
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
