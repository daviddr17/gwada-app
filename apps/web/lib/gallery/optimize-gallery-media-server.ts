import "server-only";

import {
  GALLERY_MEDIA_BUCKET,
  buildGalleryMediaVariantPath,
  galleryMediaKindFromMime,
} from "@/lib/gallery/gallery-media";
import {
  FEED_MEDIA_OUTPUT_MIME,
  processFeedMediaImage,
} from "@/lib/images/process-feed-media-image";
import type { SupabaseClient } from "@supabase/supabase-js";

const BATCH_LIMIT = 8;

type LegacyGalleryRow = {
  id: string;
  restaurant_id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
};

/** Bestehende Gwada-Galerie-JPGs → WebP Preview + Thumb (schrittweise pro Sync). */
export async function optimizeLegacyGalleryMediaBatch(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ optimized: number; errors: number }> {
  const { data, error } = await admin
    .from("gwada_gallery_items")
    .select("id, restaurant_id, storage_path, mime_type, size_bytes")
    .eq("restaurant_id", restaurantId)
    .is("thumb_storage_path", null)
    .limit(BATCH_LIMIT);

  if (error || !data?.length) {
    return { optimized: 0, errors: error ? 1 : 0 };
  }

  let optimized = 0;
  let errors = 0;

  for (const row of data as LegacyGalleryRow[]) {
    if (galleryMediaKindFromMime(row.mime_type) !== "image") continue;
    try {
      const { data: blob, error: downloadError } = await admin.storage
        .from(GALLERY_MEDIA_BUCKET)
        .download(row.storage_path);
      if (downloadError || !blob) {
        errors += 1;
        continue;
      }

      const input = Buffer.from(await blob.arrayBuffer());
      const processed = await processFeedMediaImage(input);
      const previewPath = buildGalleryMediaVariantPath({
        restaurantId: row.restaurant_id,
        itemId: row.id,
        variant: "preview",
      });
      const thumbPath = buildGalleryMediaVariantPath({
        restaurantId: row.restaurant_id,
        itemId: row.id,
        variant: "thumb",
      });

      const [previewUpload, thumbUpload] = await Promise.all([
        admin.storage.from(GALLERY_MEDIA_BUCKET).upload(previewPath, processed.preview, {
          contentType: FEED_MEDIA_OUTPUT_MIME,
          upsert: true,
        }),
        admin.storage.from(GALLERY_MEDIA_BUCKET).upload(thumbPath, processed.thumb, {
          contentType: FEED_MEDIA_OUTPUT_MIME,
          upsert: true,
        }),
      ]);

      if (previewUpload.error || thumbUpload.error) {
        errors += 1;
        continue;
      }

      const nextSize =
        processed.previewSizeBytes + processed.thumbSizeBytes;

      const { error: updateError } = await admin
        .from("gwada_gallery_items")
        .update({
          storage_path: previewPath,
          thumb_storage_path: thumbPath,
          blur_data_url: processed.blurDataUrl,
          mime_type: FEED_MEDIA_OUTPUT_MIME,
          width: processed.width,
          height: processed.height,
          size_bytes: nextSize,
        })
        .eq("id", row.id);

      if (updateError) {
        errors += 1;
        continue;
      }

      if (row.storage_path !== previewPath) {
        await admin.storage.from(GALLERY_MEDIA_BUCKET).remove([row.storage_path]);
      }

      optimized += 1;
    } catch {
      errors += 1;
    }
  }

  return { optimized, errors };
}
