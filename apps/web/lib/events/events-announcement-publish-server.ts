import "server-only";

import {
  EVENTS_ANNOUNCEMENT_PLATFORMS,
  type EventsPlatform,
} from "@/lib/constants/events-platforms";
import { getEventsConnector } from "@/lib/events/connectors/registry";
import type {
  EventsPublishInput,
  EventsPublishResult,
} from "@/lib/events/connectors/types";
import { buildEventAnnouncementBody } from "@/lib/events/format-events-display-date";
import { getNewsConnector } from "@/lib/news/connectors/registry";
import type { SupabaseClient } from "@supabase/supabase-js";

export type EventsAnnouncementPlatform =
  (typeof EVENTS_ANNOUNCEMENT_PLATFORMS)[number];

export function isEventsAnnouncementPlatform(
  platform: EventsPlatform,
): platform is EventsAnnouncementPlatform {
  return (EVENTS_ANNOUNCEMENT_PLATFORMS as readonly string[]).includes(platform);
}

export async function publishEventsAnnouncement(
  restaurantId: string,
  sb: SupabaseClient,
  platform: EventsAnnouncementPlatform,
  input: EventsPublishInput,
): Promise<EventsPublishResult> {
  if (platform === "instagram" || platform === "whatsapp_channel") {
    const connector = getEventsConnector(platform);
    if (!connector.publishEvent) {
      return { ok: false, error: "publish_not_supported" };
    }
    return connector.publishEvent(restaurantId, sb, input);
  }

  const newsConnector = getNewsConnector(platform);
  if (!newsConnector.publishPost) {
    return { ok: false, error: "publish_not_supported" };
  }

  const body = buildEventAnnouncementBody({
    title: input.title,
    description: input.description,
    startAt: input.startAt,
    endAt: input.endAt,
    ticketUrl: input.ticketUrl,
    location: input.location,
  });

  return newsConnector.publishPost(restaurantId, sb, {
    title: input.title,
    body,
    mediaStoragePaths: [],
    mediaUrls: input.coverUrl ? [input.coverUrl] : [],
    scheduledAt: null,
  });
}

type AnnouncementPostMeta = {
  externalId: string | null;
  externalUrl: string | null;
  publishedAt: string | null;
  status: "published" | "failed";
  lastError?: string | null;
};

export async function applyEventsAnnouncementPublication(
  sb: SupabaseClient,
  params: {
    eventId: string;
    restaurantId: string;
    platform: EventsAnnouncementPlatform;
    eventPlatformSelected: boolean;
    result: EventsPublishResult;
  },
): Promise<void> {
  const meta: AnnouncementPostMeta = params.result.ok
    ? {
        externalId: params.result.externalId,
        externalUrl: params.result.externalUrl,
        publishedAt: params.result.publishedAt ?? new Date().toISOString(),
        status: "published",
        lastError: null,
      }
    : {
        externalId: null,
        externalUrl: null,
        publishedAt: null,
        status: "failed",
        lastError: params.result.error,
      };

  if (params.eventPlatformSelected) {
    const { data: row } = await sb
      .from("gwada_event_publications")
      .select("platform_config")
      .eq("event_id", params.eventId)
      .eq("platform", params.platform)
      .maybeSingle();

    const existingConfig =
      row?.platform_config &&
      typeof row.platform_config === "object" &&
      !Array.isArray(row.platform_config)
        ? (row.platform_config as Record<string, unknown>)
        : {};

    await sb
      .from("gwada_event_publications")
      .update({
        platform_config: {
          ...existingConfig,
          announcementPost: meta,
        },
      })
      .eq("event_id", params.eventId)
      .eq("platform", params.platform);
    return;
  }

  await sb.from("gwada_event_publications").upsert(
    {
      event_id: params.eventId,
      restaurant_id: params.restaurantId,
      platform: params.platform,
      status: meta.status,
      external_id: meta.externalId,
      external_url: meta.externalUrl,
      published_at: meta.publishedAt,
      last_error: meta.lastError ?? null,
      platform_config: { announcementOnly: true },
    },
    { onConflict: "event_id,platform" },
  );
}
