import "server-only";

import { rewriteAdminSignedStorageUrl } from "@/lib/auth/rewrite-admin-auth-action-link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const GALLERY_MEDIA_BUCKET = "gallery-media";

export function buildGalleryMediaStoragePath(params: {
  restaurantId: string;
  itemId: string;
  fileName: string;
}): string {
  const safe = params.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return `${params.restaurantId}/${params.itemId}/${Date.now()}_${safe}`;
}

export function buildGalleryMediaVariantPath(params: {
  restaurantId: string;
  itemId: string;
  variant: "preview" | "thumb";
}): string {
  return `${params.restaurantId}/${params.itemId}/${Date.now()}_${params.variant}.webp`;
}

export function galleryMediaKindFromMime(mime: string): "image" | "video" {
  return mime.startsWith("video/") ? "video" : "image";
}

export async function resolveGalleryMediaSignedUrl(
  storagePath: string,
  expiresIn = 7200,
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin.storage
    .from(GALLERY_MEDIA_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  return data?.signedUrl
    ? rewriteAdminSignedStorageUrl(data.signedUrl)
    : null;
}

export async function resolveGalleryMediaSignedUrls(
  storagePaths: string[],
  expiresIn = 7200,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const path of storagePaths) {
    const url = await resolveGalleryMediaSignedUrl(path, expiresIn);
    if (url) map.set(path, url);
  }
  return map;
}
