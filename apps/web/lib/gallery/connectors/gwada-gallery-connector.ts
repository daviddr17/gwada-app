import "server-only";

import { galleryCategoryLabelForPlatform } from "@/lib/gallery/gallery-categories";
import type { GalleryPlatformConnector } from "@/lib/gallery/connectors/types";
import type { UnifiedGalleryItem } from "@/lib/gallery/unified-gallery-item";
import {
  GALLERY_MEDIA_BUCKET,
  galleryMediaKindFromMime,
  resolveGalleryMediaSignedUrl,
} from "@/lib/gallery/gallery-media";
import type { SupabaseClient } from "@supabase/supabase-js";

const CAPABILITIES = {
  canReadGallery: true,
  canUpload: true,
  canUpdate: true,
  canDelete: true,
  supportsVideo: true,
  supportsCategories: true,
} as const;

type GwadaGalleryRow = {
  id: string;
  restaurant_id: string;
  title: string | null;
  caption: string | null;
  category: string | null;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  created_at: string;
};

async function mapRow(
  row: GwadaGalleryRow,
): Promise<UnifiedGalleryItem | null> {
  const signedUrl = await resolveGalleryMediaSignedUrl(row.storage_path);
  if (!signedUrl) return null;
  const kind = galleryMediaKindFromMime(row.mime_type);
  return {
    id: `gwada:${row.id}`,
    platform: "gwada",
    source: "gwada",
    itemId: row.id,
    title: row.title,
    caption: row.caption,
    category: row.category,
    categoryLabel: galleryCategoryLabelForPlatform("gwada", row.category),
    mediaKind: kind,
    previewUrl: signedUrl,
    fullUrl: signedUrl,
    width: row.width,
    height: row.height,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    canEdit: true,
    canDelete: true,
    externalUrl: null,
    externalId: row.id,
    parentExternalId: null,
  };
}

export const gwadaGalleryConnector: GalleryPlatformConnector = {
  key: "gwada",
  displayName: "Gwada",
  capabilities: CAPABILITIES,
  async isConnected() {
    return true;
  },
  async fetchGalleryItems(restaurantId, sb) {
    const { data, error } = await sb
      .from("gwada_gallery_items")
      .select(
        "id, restaurant_id, title, caption, category, storage_path, mime_type, size_bytes, width, height, created_at",
      )
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false });

    if (error) return { error: error.message };

    const items: UnifiedGalleryItem[] = [];
    for (const row of (data ?? []) as GwadaGalleryRow[]) {
      const item = await mapRow(row);
      if (item) items.push(item);
    }
    return { items };
  },
};

export async function fetchGwadaGalleryItemById(
  sb: SupabaseClient,
  restaurantId: string,
  itemId: string,
): Promise<UnifiedGalleryItem | null> {
  const { data, error } = await sb
    .from("gwada_gallery_items")
    .select(
      "id, restaurant_id, title, caption, category, storage_path, mime_type, size_bytes, width, height, created_at",
    )
    .eq("restaurant_id", restaurantId)
    .eq("id", itemId)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as GwadaGalleryRow);
}

export { GALLERY_MEDIA_BUCKET };
