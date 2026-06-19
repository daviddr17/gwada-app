import "server-only";

import type { EventsPlatform } from "@/lib/constants/events-platforms";
import {
  applyEventsAnnouncementPublication,
  isEventsAnnouncementPlatform,
  publishEventsAnnouncement,
} from "@/lib/events/events-announcement-publish-server";
import { getEventsConnector } from "@/lib/events/connectors/registry";
import type { EventsPublishInput } from "@/lib/events/connectors/types";
import { syncRestaurantEventsPlatformAfterPublish } from "@/lib/events/events-feed-sync-server";
import { resolveEventsCoverSignedUrl } from "@/lib/events/events-media";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function createAndPublishEvent(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    userId: string;
    eventId?: string;
    title: string;
    description: string;
    startAt: string;
    endAt: string | null;
    ticketUrl: string | null;
    location: string | null;
    coverStoragePath: string | null;
    coverMimeType: string | null;
    scheduledAt: string | null;
    platforms: EventsPlatform[];
    announcementPlatforms?: EventsPlatform[];
  },
): Promise<{ ok: true; eventId: string } | { ok: false; error: string }> {
  const isScheduled =
    params.scheduledAt != null &&
    new Date(params.scheduledAt).getTime() > Date.now() + 30_000;

  const insertRow: Record<string, unknown> = {
    restaurant_id: params.restaurantId,
    title: params.title,
    description: params.description,
    start_at: params.startAt,
    end_at: params.endAt,
    ticket_url: params.ticketUrl,
    location: params.location,
    cover_storage_path: params.coverStoragePath,
    cover_mime_type: params.coverMimeType,
    status: isScheduled ? "scheduled" : "draft",
    scheduled_at: isScheduled ? params.scheduledAt : null,
    created_by: params.userId,
    updated_by: params.userId,
  };
  if (params.eventId) insertRow.id = params.eventId;

  const { data: event, error: eventError } = await sb
    .from("gwada_events")
    .insert(insertRow)
    .select("id")
    .single();

  if (eventError || !event) {
    return { ok: false, error: eventError?.message ?? "event_create_failed" };
  }

  const eventId = event.id as string;
  const coverUrl = isScheduled
    ? null
    : await resolveEventsCoverSignedUrl(params.coverStoragePath);

  const publishPlatforms = [...params.platforms];
  const announcementPlatforms = (params.announcementPlatforms ?? []).filter(
    isEventsAnnouncementPlatform,
  );

  const pubInput: EventsPublishInput = {
    title: params.title,
    description: params.description,
    startAt: params.startAt,
    endAt: params.endAt,
    ticketUrl: params.ticketUrl,
    location: params.location,
    coverStoragePath: params.coverStoragePath,
    coverUrl,
    scheduledAt: params.scheduledAt,
  };

  for (const platform of publishPlatforms.length ? publishPlatforms : (["gwada"] as EventsPlatform[])) {
    const connector = getEventsConnector(platform);

    await sb.from("gwada_event_publications").upsert(
      {
        event_id: eventId,
        restaurant_id: params.restaurantId,
        platform,
        status: isScheduled ? "scheduled" : "pending",
        scheduled_at: isScheduled ? params.scheduledAt : null,
      },
      { onConflict: "event_id,platform" },
    );

    if (isScheduled) continue;

    if (platform === "gwada") {
      await sb
        .from("gwada_event_publications")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("event_id", eventId)
        .eq("platform", platform);
      continue;
    }

    if (!connector.publishEvent) {
      await sb
        .from("gwada_event_publications")
        .update({ status: "failed", last_error: "publish_not_supported" })
        .eq("event_id", eventId)
        .eq("platform", platform);
      continue;
    }

    const result = await connector.publishEvent(params.restaurantId, sb, pubInput);
    if (!result.ok) {
      await sb
        .from("gwada_event_publications")
        .update({ status: "failed", last_error: result.error })
        .eq("event_id", eventId)
        .eq("platform", platform);
      continue;
    }

    await sb
      .from("gwada_event_publications")
      .update({
        status: "published",
        external_id: result.externalId,
        external_url: result.externalUrl,
        published_at: result.publishedAt ?? new Date().toISOString(),
        last_error: null,
      })
      .eq("event_id", eventId)
      .eq("platform", platform);

    void syncRestaurantEventsPlatformAfterPublish(params.restaurantId, platform);
  }

  if (!isScheduled) {
    for (const platform of announcementPlatforms) {
      const eventPlatformSelected = publishPlatforms.includes(platform);
      if (!eventPlatformSelected) {
        await sb.from("gwada_event_publications").upsert(
          {
            event_id: eventId,
            restaurant_id: params.restaurantId,
            platform,
            status: "pending",
          },
          { onConflict: "event_id,platform" },
        );
      }

      const result = await publishEventsAnnouncement(
        params.restaurantId,
        sb,
        platform,
        pubInput,
      );
      await applyEventsAnnouncementPublication(sb, {
        eventId,
        restaurantId: params.restaurantId,
        platform,
        eventPlatformSelected,
        result,
      });
    }
  }

  if (!isScheduled) {
    const hasGwada = publishPlatforms.includes("gwada");
    if (hasGwada) {
      await sb
        .from("gwada_events")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          updated_by: params.userId,
        })
        .eq("id", eventId);
    } else {
      const { data: pubs } = await sb
        .from("gwada_event_publications")
        .select("status")
        .eq("event_id", eventId);
      const anyPublished = (pubs ?? []).some((p) => p.status === "published");
      await sb
        .from("gwada_events")
        .update({
          status: anyPublished ? "published" : "failed",
          published_at: anyPublished ? new Date().toISOString() : null,
          updated_by: params.userId,
        })
        .eq("id", eventId);
    }
  }

  return { ok: true, eventId };
}
