import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { EventsPlatform } from "@/lib/constants/events-platforms";
import {
  EVENTS_CACHEABLE_PLATFORMS,
  isEventsCacheablePlatform,
} from "@/lib/constants/events-platforms";
import type { EventsStatsPeriod } from "@/lib/events/compute-events-statistics";
import type { UnifiedEventItem } from "@/lib/events/unified-event-item";
import { startOfLocalDay } from "@/lib/reservations/month-range";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type EventsPlatformSyncAnalyticsRow = {
  platform: EventsPlatform;
  item_count: number;
  synced_at: string | null;
  last_error: string | null;
};

export type EventsStatisticsBundle = {
  items: UnifiedEventItem[];
  syncRows: EventsPlatformSyncAnalyticsRow[];
  periodStart: Date;
  periodEnd: Date;
};

function periodRange(monthsBack: EventsStatsPeriod): {
  periodStart: Date;
  periodEnd: Date;
} {
  const periodEnd = startOfLocalDay(new Date());
  periodEnd.setHours(23, 59, 59, 999);
  const periodStart = startOfLocalDay(new Date());
  periodStart.setMonth(periodStart.getMonth() - monthsBack);
  return { periodStart, periodEnd };
}

function parseCachedItem(raw: unknown): UnifiedEventItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.title !== "string") return null;
  if (typeof o.startAt !== "string") return null;
  return raw as UnifiedEventItem;
}

function mapGwadaRow(raw: Record<string, unknown>): UnifiedEventItem {
  const status = raw.status as UnifiedEventItem["status"];
  return {
    id: `gwada:${raw.id as string}`,
    platform: "gwada",
    source: "gwada",
    eventId: raw.id as string,
    title: (raw.title as string) ?? "",
    description: (raw.description as string) ?? "",
    coverUrl: null,
    coverStoragePath: (raw.cover_storage_path as string | null) ?? null,
    startAt: raw.start_at as string,
    endAt: (raw.end_at as string | null) ?? null,
    ticketUrl: (raw.ticket_url as string | null) ?? null,
    location: (raw.location as string | null) ?? null,
    status,
    canEdit: status !== "cancelled",
    canDelete: true,
    externalUrl: null,
    createdAt: raw.created_at as string,
    publishedAt: (raw.published_at as string | null) ?? null,
  };
}

export async function fetchEventsStatisticsBundle(params: {
  restaurantId: string;
  monthsBack?: EventsStatsPeriod;
}): Promise<{ data: EventsStatisticsBundle | null; error: string | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { data: null, error: null };
  }

  const months = params.monthsBack ?? 12;
  const { periodStart, periodEnd } = periodRange(months);
  const sb = createSupabaseBrowserClient();

  const [gwadaRes, cacheRes, syncRes] = await Promise.all([
    sb
      .from("gwada_events")
      .select(
        "id, title, description, start_at, end_at, ticket_url, location, cover_storage_path, status, created_at, published_at",
      )
      .eq("restaurant_id", params.restaurantId)
      .neq("status", "cancelled"),
    sb
      .from("restaurant_events_platform_cache")
      .select("item")
      .eq("restaurant_id", params.restaurantId),
    sb
      .from("restaurant_events_platform_sync")
      .select("platform, item_count, synced_at, last_error")
      .eq("restaurant_id", params.restaurantId),
  ]);

  const items: UnifiedEventItem[] = [];

  for (const row of gwadaRes.data ?? []) {
    items.push(mapGwadaRow(row as Record<string, unknown>));
  }

  for (const row of cacheRes.data ?? []) {
    const item = parseCachedItem(row.item);
    if (item) items.push(item);
  }

  const syncRows: EventsPlatformSyncAnalyticsRow[] = (syncRes.data ?? [])
    .filter(
      (row): row is EventsPlatformSyncAnalyticsRow =>
        typeof row.platform === "string" &&
        isEventsCacheablePlatform(row.platform as EventsPlatform),
    )
    .map((row) => ({
      platform: row.platform as EventsPlatform,
      item_count: Number(row.item_count ?? 0),
      synced_at: (row.synced_at as string | null) ?? null,
      last_error: (row.last_error as string | null) ?? null,
    }));

  for (const platform of EVENTS_CACHEABLE_PLATFORMS) {
    if (!syncRows.some((row) => row.platform === platform)) {
      syncRows.push({
        platform,
        item_count: 0,
        synced_at: null,
        last_error: null,
      });
    }
  }

  if (gwadaRes.error) {
    return { data: null, error: gwadaRes.error.message };
  }

  return {
    data: {
      items,
      syncRows,
      periodStart,
      periodEnd,
    },
    error: null,
  };
}
