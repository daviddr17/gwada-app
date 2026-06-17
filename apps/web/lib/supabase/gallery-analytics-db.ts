import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { GalleryPlatform } from "@/lib/constants/gallery-platforms";
import type { GalleryStatsPeriod } from "@/lib/gallery/compute-gallery-statistics";
import { galleryMediaKindFromMime } from "@/lib/gallery/validate-gallery-media-file";
import {
  exclusiveUtcIsoAfterLocalVisibleEnd,
  startOfLocalDay,
} from "@/lib/reservations/month-range";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type GalleryItemAnalyticsRow = {
  id: string;
  platform: GalleryPlatform;
  media_kind: "image" | "video";
  category: string | null;
  category_label: string | null;
  created_at: string;
  size_bytes: number | null;
  source: "gwada" | "external";
};

export type GalleryHighlightAnalyticsRow = {
  id: string;
  title: string;
  item_count: number;
  created_at: string;
};

export type GalleryPlatformSyncAnalyticsRow = {
  platform: GalleryPlatform;
  item_count: number;
  synced_at: string | null;
};

export type GalleryStatisticsBundle = {
  items: GalleryItemAnalyticsRow[];
  highlights: GalleryHighlightAnalyticsRow[];
  syncRows: GalleryPlatformSyncAnalyticsRow[];
  periodStart: Date;
  periodEnd: Date;
};

function periodRange(monthsBack: GalleryStatsPeriod): {
  periodStart: Date;
  periodEnd: Date;
} {
  const periodEnd = startOfLocalDay(new Date());
  const periodStart = startOfLocalDay(new Date());
  periodStart.setMonth(periodStart.getMonth() - monthsBack);
  return { periodStart, periodEnd };
}

function parseCachedGalleryItem(raw: unknown): GalleryItemAnalyticsRow | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.platform !== "string") return null;
  if (typeof o.createdAt !== "string") return null;
  const platform = o.platform as GalleryPlatform;
  if (
    platform !== "facebook" &&
    platform !== "instagram" &&
    platform !== "google_business"
  ) {
    return null;
  }
  const mediaKind =
    o.mediaKind === "video" ? "video" : ("image" as const);
  return {
    id: o.id,
    platform,
    media_kind: mediaKind,
    category: (o.category as string | null) ?? null,
    category_label: (o.categoryLabel as string | null) ?? null,
    created_at: o.createdAt,
    size_bytes:
      typeof o.sizeBytes === "number" ? o.sizeBytes : null,
    source: "external",
  };
}

export async function fetchGalleryStatisticsBundle(params: {
  restaurantId: string;
  monthsBack?: GalleryStatsPeriod;
}): Promise<{ data: GalleryStatisticsBundle | null; error: string | null }> {
  if (!isUuidRestaurantId(params.restaurantId)) {
    return { data: null, error: null };
  }

  const months = params.monthsBack ?? 12;
  const { periodStart, periodEnd } = periodRange(months);

  const sb = createSupabaseBrowserClient();
  const [gwadaRes, cacheRes, highlightsRes, syncRes] = await Promise.all([
    sb
      .from("gwada_gallery_items")
      .select("id, category, mime_type, size_bytes, created_at")
      .eq("restaurant_id", params.restaurantId)
      .order("created_at", { ascending: true }),
    sb
      .from("restaurant_gallery_platform_cache")
      .select("item, created_at, category")
      .eq("restaurant_id", params.restaurantId),
    sb
      .from("gwada_gallery_highlights")
      .select("id, title, created_at, gwada_gallery_highlight_items ( item_id )")
      .eq("restaurant_id", params.restaurantId)
      .order("created_at", { ascending: true }),
    sb
      .from("restaurant_gallery_platform_sync")
      .select("platform, item_count, synced_at")
      .eq("restaurant_id", params.restaurantId),
  ]);

  const error =
    gwadaRes.error?.message ??
    cacheRes.error?.message ??
    highlightsRes.error?.message ??
    syncRes.error?.message ??
    null;
  if (error) {
    return { data: null, error };
  }

  const gwadaItems: GalleryItemAnalyticsRow[] = (gwadaRes.data ?? []).map(
    (raw) => {
      const row = raw as Record<string, unknown>;
      const mime = row.mime_type as string;
      return {
        id: row.id as string,
        platform: "gwada",
        media_kind: galleryMediaKindFromMime(mime),
        category: (row.category as string | null) ?? null,
        category_label: null,
        created_at: row.created_at as string,
        size_bytes: Number(row.size_bytes),
        source: "gwada",
      };
    },
  );

  const cachedItems: GalleryItemAnalyticsRow[] = [];
  for (const row of cacheRes.data ?? []) {
    const parsed = parseCachedGalleryItem(row.item);
    if (!parsed) continue;
    cachedItems.push(parsed);
  }

  const highlights: GalleryHighlightAnalyticsRow[] = (highlightsRes.data ?? []).map(
    (raw) => {
      const row = raw as Record<string, unknown>;
      const items = row.gwada_gallery_highlight_items as unknown[] | null;
      return {
        id: row.id as string,
        title: row.title as string,
        item_count: items?.length ?? 0,
        created_at: row.created_at as string,
      };
    },
  );

  const syncRows: GalleryPlatformSyncAnalyticsRow[] = (syncRes.data ?? []).map(
    (raw) => {
      const row = raw as Record<string, unknown>;
      return {
        platform: row.platform as GalleryPlatform,
        item_count: Number(row.item_count ?? 0),
        synced_at: (row.synced_at as string | null) ?? null,
      };
    },
  );

  return {
    data: {
      items: [...gwadaItems, ...cachedItems],
      highlights,
      syncRows,
      periodStart,
      periodEnd,
    },
    error: null,
  };
}
