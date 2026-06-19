import "server-only";

import type { EventsCacheablePlatform } from "@/lib/constants/events-platforms";
import { isEventsCacheablePlatform } from "@/lib/constants/events-platforms";
import type { EventsPlatform } from "@/lib/constants/events-platforms";
import { sortEventsByStartAt } from "@/lib/events/format-events-display-date";
import type { UnifiedEventItem } from "@/lib/events/unified-event-item";
import type { SupabaseClient } from "@supabase/supabase-js";

export type EventsPlatformSyncRow = {
  platform: EventsCacheablePlatform;
  synced_at: string | null;
  last_error: string | null;
  item_count: number;
};

export function externalIdFromEventItem(item: UnifiedEventItem): string {
  const prefix = `${item.platform}:`;
  if (item.id.startsWith(prefix)) return item.id.slice(prefix.length);
  return item.id;
}

function parseCachedItem(raw: unknown): UnifiedEventItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.platform !== "string") return null;
  if (typeof o.title !== "string" || typeof o.startAt !== "string") return null;
  return raw as UnifiedEventItem;
}

export async function readEventsPlatformSyncState(
  sb: SupabaseClient,
  restaurantId: string,
  platforms?: EventsCacheablePlatform[],
): Promise<EventsPlatformSyncRow[]> {
  let query = sb
    .from("restaurant_events_platform_sync")
    .select("platform, synced_at, last_error, item_count")
    .eq("restaurant_id", restaurantId);

  if (platforms?.length) {
    query = query.in("platform", platforms);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[gwada] events sync state read", error.message);
    return [];
  }

  return (data ?? [])
    .filter(
      (row): row is EventsPlatformSyncRow =>
        typeof row.platform === "string" &&
        isEventsCacheablePlatform(row.platform as EventsPlatform),
    )
    .map((row) => ({
      platform: row.platform as EventsCacheablePlatform,
      synced_at: (row.synced_at as string | null) ?? null,
      last_error: (row.last_error as string | null) ?? null,
      item_count: Number(row.item_count ?? 0),
    }));
}

export async function readCachedEventsItems(
  sb: SupabaseClient,
  restaurantId: string,
  platforms?: EventsCacheablePlatform[],
): Promise<UnifiedEventItem[]> {
  let query = sb
    .from("restaurant_events_platform_cache")
    .select("item, start_at, is_pinned")
    .eq("restaurant_id", restaurantId)
    .order("start_at", { ascending: false, nullsFirst: false });

  if (platforms?.length) {
    query = query.in("platform", platforms);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[gwada] events cache read", error.message);
    return [];
  }

  const items: UnifiedEventItem[] = [];
  for (const row of data ?? []) {
    const item = parseCachedItem(row.item);
    if (!item) continue;
    const rowStartAt = row.start_at as string | null | undefined;
    if (rowStartAt && item.startAt !== rowStartAt) {
      item.startAt = rowStartAt;
    }
    item.isPinned = Boolean(row.is_pinned);
    items.push(item);
  }
  return sortEventsByStartAt(items);
}

export async function upsertEventsPlatformCache(
  admin: SupabaseClient,
  restaurantId: string,
  platform: EventsCacheablePlatform,
  items: UnifiedEventItem[],
  syncedAt: string,
  lastError: string | null,
): Promise<void> {
  const seenExternalIds = new Set<string>();
  const now = syncedAt;

  if (items.length > 0) {
    const rows = items.map((item) => {
      const externalId = externalIdFromEventItem(item);
      seenExternalIds.add(externalId);
      return {
        restaurant_id: restaurantId,
        platform,
        external_id: externalId,
        item,
        start_at: item.startAt,
        fetched_at: now,
      };
    });

    const { error: upsertError } = await admin
      .from("restaurant_events_platform_cache")
      .upsert(rows, { onConflict: "restaurant_id,platform,external_id" });

    if (upsertError) {
      console.warn("[gwada] events cache upsert", platform, upsertError.message);
    }
  }

  const { data: existing } = await admin
    .from("restaurant_events_platform_cache")
    .select("external_id")
    .eq("restaurant_id", restaurantId)
    .eq("platform", platform);

  const staleIds = (existing ?? [])
    .map((row) => row.external_id as string)
    .filter((id) => !seenExternalIds.has(id));

  if (staleIds.length > 0) {
    await admin
      .from("restaurant_events_platform_cache")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("platform", platform)
      .in("external_id", staleIds);
  }

  if (items.length === 0) {
    await admin
      .from("restaurant_events_platform_cache")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("platform", platform);
  }

  await admin.from("restaurant_events_platform_sync").upsert(
    {
      restaurant_id: restaurantId,
      platform,
      synced_at: now,
      last_error: lastError,
      item_count: items.length,
    },
    { onConflict: "restaurant_id,platform" },
  );
}
