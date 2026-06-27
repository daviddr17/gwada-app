import "server-only";

import type { NewsPlatform } from "@/lib/constants/news-platforms";
import { NEWS_PLATFORM_LABELS } from "@/lib/constants/news-platforms";
import { facebookNewsConnector } from "@/lib/news/connectors/facebook-connector";
import { googleBusinessNewsConnector } from "@/lib/news/connectors/google-business-connector";
import { gwadaNewsConnector } from "@/lib/news/connectors/gwada-connector";
import { instagramNewsConnector } from "@/lib/news/connectors/instagram-connector";
import { whatsappChannelNewsConnector } from "@/lib/news/connectors/whatsapp-channel-connector";
import type {
  NewsPlatformConnector,
} from "@/lib/news/connectors/types";
import type { NewsConnectorPublicInfo } from "@/lib/types/news-connectors";
import { fetchWithTimeout } from "@/lib/news/fetch-with-timeout";
import { sortNewsItemsByDate } from "@/lib/news/format-news-display-date";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import {
  isFeedConnectorEnabledBySuperadmin,
  resolveFeedConnectorConnected,
} from "@/lib/platform-feed/feed-platform-superadmin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  fetchPlatformMessagingFlags,
  type PlatformMessagingFlags,
} from "@/lib/supabase/platform-messaging-db";
import type { SupabaseClient } from "@supabase/supabase-js";

const CONNECTOR_FETCH_TIMEOUT_MS = 8_000;

const CONNECTORS: Record<NewsPlatform, NewsPlatformConnector> = {
  gwada: gwadaNewsConnector,
  facebook: facebookNewsConnector,
  instagram: instagramNewsConnector,
  google_business: googleBusinessNewsConnector,
  whatsapp_channel: whatsappChannelNewsConnector,
};

export function getNewsConnector(platform: NewsPlatform): NewsPlatformConnector {
  return CONNECTORS[platform];
}

export async function getNewsConnectorPublicInfo(
  restaurantId: string,
): Promise<NewsConnectorPublicInfo[]> {
  const admin = createSupabaseAdminClient();
  const flags: PlatformMessagingFlags = admin
    ? await fetchPlatformMessagingFlags(admin)
    : {
        whatsappEnabled: false,
        emailEnabled: false,
        facebookEnabled: false,
        instagramEnabled: false,
        googleBusinessEnabled: false,
        lexofficeEnabled: false,
      };

  const platforms = Object.keys(CONNECTORS) as NewsPlatform[];
  return Promise.all(
    platforms.map(async (key) => {
      const connector = CONNECTORS[key];
      const connected = await resolveFeedConnectorConnected(
        key,
        restaurantId,
        connector.isConnected.bind(connector),
        flags,
      );
      return {
        key,
        displayName: NEWS_PLATFORM_LABELS[key],
        connected,
        capabilities: connector.capabilities,
        externalEditBaseUrl: connector.externalEditUrl(null),
      };
    }),
  );
}

export async function fetchUnifiedNewsFeed(
  restaurantId: string,
  sb: SupabaseClient,
  platforms?: NewsPlatform[],
): Promise<UnifiedNewsItem[]> {
  const admin = createSupabaseAdminClient();
  const flags = admin
    ? await fetchPlatformMessagingFlags(admin)
    : {
        whatsappEnabled: false,
        emailEnabled: false,
        facebookEnabled: false,
        instagramEnabled: false,
        googleBusinessEnabled: false,
        lexofficeEnabled: false,
      };

  const keys = platforms ?? (Object.keys(CONNECTORS) as NewsPlatform[]);
  const batches = await Promise.all(
    keys.map(async (key) => {
      const connector = CONNECTORS[key];
      if (!connector.capabilities.canReadFeed) return [] as UnifiedNewsItem[];
      const connected = await resolveFeedConnectorConnected(
        key,
        restaurantId,
        connector.isConnected.bind(connector),
        flags,
      );
      if (!connected) return [] as UnifiedNewsItem[];
      const result = await fetchWithTimeout(
        connector.fetchFeed(restaurantId, sb),
        { error: "timeout" } as const,
        CONNECTOR_FETCH_TIMEOUT_MS,
      );
      if ("error" in result) {
        if (result.error !== "timeout") {
          console.warn("[gwada] news feed", key, result.error);
        }
        return [] as UnifiedNewsItem[];
      }
      return result.items;
    }),
  );
  return sortNewsItemsByDate(batches.flat());
}
