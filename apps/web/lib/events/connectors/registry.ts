import "server-only";

import type { EventsPlatform } from "@/lib/constants/events-platforms";
import { EVENTS_PLATFORM_LABELS } from "@/lib/constants/events-platforms";
import { facebookEventsConnector } from "@/lib/events/connectors/facebook-events-connector";
import { googleBusinessEventsConnector } from "@/lib/events/connectors/google-business-events-connector";
import { gwadaEventsConnector } from "@/lib/events/connectors/gwada-connector";
import { instagramEventsAnnouncementConnector } from "@/lib/events/connectors/instagram-announcement-connector";
import { whatsappChannelEventsAnnouncementConnector } from "@/lib/events/connectors/whatsapp-channel-connector";
import type { EventsPlatformConnector } from "@/lib/events/connectors/types";
import type { EventsConnectorPublicInfo } from "@/lib/types/events-connectors";
import { sortEventsByStartAt } from "@/lib/events/format-events-display-date";
import type { UnifiedEventItem } from "@/lib/events/unified-event-item";
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

const CONNECTORS: Record<EventsPlatform, EventsPlatformConnector> = {
  gwada: gwadaEventsConnector,
  facebook: facebookEventsConnector,
  google_business: googleBusinessEventsConnector,
  instagram: instagramEventsAnnouncementConnector,
  whatsapp_channel: whatsappChannelEventsAnnouncementConnector,
};

export function getEventsConnector(platform: EventsPlatform): EventsPlatformConnector {
  return CONNECTORS[platform];
}

export async function getEventsConnectorPublicInfo(
  restaurantId: string,
): Promise<EventsConnectorPublicInfo[]> {
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
        tripadvisorEnabled: false,
        appleBusinessConnectEnabled: false,
      };

  const platforms = Object.keys(CONNECTORS) as EventsPlatform[];
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
        displayName: EVENTS_PLATFORM_LABELS[key],
        connected,
        capabilities: connector.capabilities,
        externalEditBaseUrl: connector.externalEditUrl(null),
      };
    }),
  );
}

export async function fetchUnifiedEventsFeed(
  restaurantId: string,
  sb: SupabaseClient,
  platforms?: EventsPlatform[],
): Promise<UnifiedEventItem[]> {
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
        tripadvisorEnabled: false,
        appleBusinessConnectEnabled: false,
      };

  const keys = platforms ?? (Object.keys(CONNECTORS) as EventsPlatform[]);
  const batches = await Promise.all(
    keys.map(async (key) => {
      const connector = CONNECTORS[key];
      if (!connector.capabilities.canReadFeed) return [] as UnifiedEventItem[];
      const connected = await resolveFeedConnectorConnected(
        key,
        restaurantId,
        connector.isConnected.bind(connector),
        flags,
      );
      if (!connected) return [] as UnifiedEventItem[];
      const result = await connector.fetchFeed(restaurantId, sb);
      if ("error" in result) {
        console.warn("[gwada] events feed", key, result.error);
        return [] as UnifiedEventItem[];
      }
      return result.items;
    }),
  );
  return sortEventsByStartAt(batches.flat());
}
