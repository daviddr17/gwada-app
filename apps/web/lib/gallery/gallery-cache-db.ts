import "server-only";

import type { GalleryPlatform } from "@/lib/constants/gallery-platforms";
import type { UnifiedGalleryItem } from "@/lib/gallery/unified-gallery-item";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isGalleryCacheablePlatform,
  type GalleryCacheablePlatform,
} from "@/lib/gallery/gallery-cache-constants";

export type GalleryPlatformSyncRow = {
  platform: GalleryCacheablePlatform;
  synced_at: string | null;
  last_error: string | null;
  item_count: number;
};

export function externalIdFromGalleryItem(item: UnifiedGalleryItem): string {
  const prefix = `${item.platform}:`;
  if (item.id.startsWith(prefix)) return item.id.slice(prefix.length);
  return item.externalId || item.id;
}

function parseCachedItem(raw: unknown): UnifiedGalleryItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.platform !== "string") return null;
  if (typeof o.previewUrl !== "string") return null;
  return raw as UnifiedGalleryItem;
}

export async function readGalleryPlatformSyncState(
  sb: SupabaseClient,
  restaurantId: string,
  platforms?: GalleryCacheablePlatform[],
): Promise<GalleryPlatformSyncRow[]> {
  let query = sb
    .from("restaurant_gallery_platform_sync")
    .select("platform, synced_at, last_error, item_count")
    .eq("restaurant_id", restaurantId);

  if (platforms?.length) {
    query = query.in("platform", platforms);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[gwada] gallery sync state read", error.message);
    return [];
  }

  return (data ?? [])
    .filter(
      (row): row is GalleryPlatformSyncRow =>
        typeof row.platform === "string" &&
        isGalleryCacheablePlatform(row.platform as GalleryPlatform),
    )
    .map((row) => ({
      platform: row.platform as GalleryCacheablePlatform,
      synced_at: (row.synced_at as string | null) ?? null,
      last_error: (row.last_error as string | null) ?? null,
      item_count: Number(row.item_count ?? 0),
    }));
}

export async function readCachedGalleryItems(
  sb: SupabaseClient,
  restaurantId: string,
  platforms?: GalleryCacheablePlatform[],
): Promise<UnifiedGalleryItem[]> {
  let query = sb
    .from("restaurant_gallery_platform_cache")
    .select("item, created_at, category")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false, nullsFirst: false });

  if (platforms?.length) {
    query = query.in("platform", platforms);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[gwada] gallery cache read", error.message);
    return [];
  }

  const items: UnifiedGalleryItem[] = [];
  for (const row of data ?? []) {
    const item = parseCachedItem(row.item);
    if (!item) continue;
    items.push(item);
  }
  return items;
}

export async function upsertGalleryPlatformCache(
  admin: SupabaseClient,
  restaurantId: string,
  platform: GalleryCacheablePlatform,
  items: UnifiedGalleryItem[],
  syncedAt: string,
  lastError: string | null,
): Promise<void> {
  const seenExternalIds = new Set<string>();

  if (items.length > 0) {
    const rows = items.map((item) => {
      const externalId = externalIdFromGalleryItem(item);
      seenExternalIds.add(externalId);
      return {
        restaurant_id: restaurantId,
        platform,
        external_id: externalId,
        item,
        category: item.category,
        created_at: item.createdAt,
      };
    });

    const { error: upsertError } = await admin
      .from("restaurant_gallery_platform_cache")
      .upsert(rows, { onConflict: "restaurant_id,platform,external_id" });

    if (upsertError) {
      console.warn("[gwada] gallery cache upsert", platform, upsertError.message);
    }
  }

  const { data: existing } = await admin
    .from("restaurant_gallery_platform_cache")
    .select("external_id")
    .eq("restaurant_id", restaurantId)
    .eq("platform", platform);

  const staleIds = (existing ?? [])
    .map((row) => row.external_id as string)
    .filter((id) => !seenExternalIds.has(id));

  if (staleIds.length > 0) {
    await admin
      .from("restaurant_gallery_platform_cache")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("platform", platform)
      .in("external_id", staleIds);
  }

  if (items.length === 0) {
    await admin
      .from("restaurant_gallery_platform_cache")
      .delete()
      .eq("restaurant_id", restaurantId)
      .eq("platform", platform);
  }

  await admin.from("restaurant_gallery_platform_sync").upsert(
    {
      restaurant_id: restaurantId,
      platform,
      synced_at: syncedAt,
      last_error: lastError,
      item_count: items.length,
    },
    { onConflict: "restaurant_id,platform" },
  );
}
