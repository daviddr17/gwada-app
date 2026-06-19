import "server-only";

import type { EventsPlatformConnector } from "@/lib/events/connectors/types";
import { resolveEventsCoverSignedUrl } from "@/lib/events/events-media";
import type { UnifiedEventItem } from "@/lib/events/unified-event-item";
import type { SupabaseClient } from "@supabase/supabase-js";

const CAPABILITIES = {
  canReadFeed: true,
  canCreateEvent: true,
  canUpdateEvent: true,
  canDeleteEvent: true,
  isAnnouncementOnly: false,
  maxCoverCount: 1,
} as const;

function mapRow(
  row: Record<string, unknown>,
  coverUrl: string | null,
): UnifiedEventItem {
  const status = row.status as UnifiedEventItem["status"];
  return {
    id: `gwada:${row.id as string}`,
    platform: "gwada",
    source: "gwada",
    eventId: row.id as string,
    title: (row.title as string) ?? "",
    description: (row.description as string) ?? "",
    coverUrl,
    coverStoragePath: (row.cover_storage_path as string | null) ?? null,
    startAt: row.start_at as string,
    endAt: (row.end_at as string | null) ?? null,
    ticketUrl: (row.ticket_url as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    status,
    canEdit: status !== "cancelled",
    canDelete: true,
    externalUrl: null,
    createdAt: row.created_at as string,
    publishedAt: (row.published_at as string | null) ?? null,
    isPinned: Boolean(row.is_pinned),
  };
}

export const gwadaEventsConnector: EventsPlatformConnector = {
  key: "gwada",
  displayName: "Gwada",
  capabilities: CAPABILITIES,
  async isConnected() {
    return true;
  },
  async fetchFeed(restaurantId, sb) {
    const { data, error } = await sb
      .from("gwada_events")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .in("status", ["published", "scheduled", "draft"])
      .order("start_at", { ascending: false })
      .limit(100);
    if (error) return { error: error.message };

    const rows = data ?? [];
    const items = await Promise.all(
      rows.map(async (row) => {
        const coverUrl = await resolveEventsCoverSignedUrl(
          (row.cover_storage_path as string | null) ?? null,
        );
        return mapRow(row as Record<string, unknown>, coverUrl);
      }),
    );
    return { items };
  },
  async publishEvent(_restaurantId, _sb, _input) {
    return {
      ok: true,
      externalId: null,
      externalUrl: null,
      publishedAt: new Date().toISOString(),
    };
  },
  externalEditUrl() {
    return null;
  },
};

export async function listGwadaEventsForRestaurant(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<UnifiedEventItem[]> {
  const result = await gwadaEventsConnector.fetchFeed(restaurantId, sb);
  if ("error" in result) return [];
  return result.items;
}
