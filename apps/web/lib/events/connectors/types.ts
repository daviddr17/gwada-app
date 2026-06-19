import "server-only";

import type { EventsPlatform } from "@/lib/constants/events-platforms";
import type { UnifiedEventItem } from "@/lib/events/unified-event-item";
import type { SupabaseClient } from "@supabase/supabase-js";

export type EventsConnectorCapabilities = {
  canReadFeed: boolean;
  canCreateEvent: boolean;
  canUpdateEvent: boolean;
  canDeleteEvent: boolean;
  isAnnouncementOnly: boolean;
  maxCoverCount: number;
};

export type EventsPublishInput = {
  title: string;
  description: string;
  startAt: string;
  endAt: string | null;
  ticketUrl: string | null;
  location: string | null;
  coverStoragePath: string | null;
  coverUrl: string | null;
  scheduledAt: string | null;
  platformConfig?: Record<string, unknown>;
};

export type EventsPublishResult =
  | {
      ok: true;
      externalId: string | null;
      externalUrl: string | null;
      publishedAt: string | null;
    }
  | { ok: false; error: string };

export type { EventsConnectorPublicInfo } from "@/lib/types/events-connectors";

export interface EventsPlatformConnector {
  key: EventsPlatform;
  displayName: string;
  capabilities: EventsConnectorCapabilities;
  isConnected(restaurantId: string): Promise<boolean>;
  fetchFeed(
    restaurantId: string,
    sb: SupabaseClient,
  ): Promise<{ items: UnifiedEventItem[] } | { error: string }>;
  publishEvent?(
    restaurantId: string,
    sb: SupabaseClient,
    input: EventsPublishInput,
  ): Promise<EventsPublishResult>;
  deleteEvent?(
    restaurantId: string,
    sb: SupabaseClient,
    externalId: string,
  ): Promise<{ ok: true } | { ok: false; error: string }>;
  externalEditUrl(externalId: string | null): string | null;
}
