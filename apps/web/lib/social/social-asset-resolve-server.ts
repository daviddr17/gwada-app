import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveEventsCoverSignedUrl } from "@/lib/events/events-media";
import { resolveGalleryMediaSignedUrl } from "@/lib/gallery/gallery-media";
import { resolveRestaurantProfileImageSignedUrl } from "@/lib/restaurant/restaurant-profile-image";
import type { SocialSuggestionAsset } from "@/lib/social/social-suggestion-types";

async function downloadBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    if (ab.byteLength < 32) return null;
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

async function resolveFromStorage(
  sb: SupabaseClient,
  asset: SocialSuggestionAsset,
): Promise<string | null> {
  const path = asset.storagePath?.trim();
  if (!path) return null;
  const bucket = asset.storageBucket?.trim();

  if (bucket === "gallery-media" || asset.source === "gallery") {
    return resolveGalleryMediaSignedUrl(path, 7200);
  }
  if (bucket === "events-media" || asset.source === "event") {
    return resolveEventsCoverSignedUrl(path, 7200);
  }
  if (bucket === "restaurant-profile-images" || asset.source === "profile") {
    return resolveRestaurantProfileImageSignedUrl(sb, path, 7200);
  }
  if (bucket) {
    const { data } = await sb.storage.from(bucket).createSignedUrl(path, 7200);
    return data?.signedUrl ?? null;
  }
  return null;
}

async function resolveMenuImageUrl(
  sb: SupabaseClient,
  restaurantId: string,
  dishId: string | undefined,
  fallbackUrl: string | null,
): Promise<string | null> {
  if (dishId) {
    const { data } = await sb
      .from("menu_items")
      .select("image_url")
      .eq("id", dishId)
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    const url = typeof data?.image_url === "string" ? data.image_url.trim() : "";
    if (url) return url;
  }
  return fallbackUrl?.trim() || null;
}

/** Frische Bild-URL (Storage neu signieren / Menü neu laden). */
export async function resolveSocialSuggestionImageUrl(
  sb: SupabaseClient,
  restaurantId: string,
  asset: SocialSuggestionAsset,
): Promise<string | null> {
  if (asset.source === "menu") {
    return resolveMenuImageUrl(
      sb,
      restaurantId,
      asset.sourceId,
      asset.imageUrl,
    );
  }

  const fromStorage = await resolveFromStorage(sb, asset);
  if (fromStorage) return fromStorage;

  const existing = asset.imageUrl?.trim();
  if (existing) return existing;
  return null;
}

export async function refreshSocialSuggestionAssets(
  sb: SupabaseClient,
  restaurantId: string,
  assets: SocialSuggestionAsset[],
): Promise<SocialSuggestionAsset[]> {
  const out: SocialSuggestionAsset[] = [];
  for (const asset of assets) {
    const imageUrl = await resolveSocialSuggestionImageUrl(
      sb,
      restaurantId,
      asset,
    );
    out.push({ ...asset, imageUrl });
  }
  return out;
}

export async function loadSocialImageBuffer(
  sb: SupabaseClient,
  restaurantId: string,
  asset: SocialSuggestionAsset,
): Promise<Buffer | null> {
  const url = await resolveSocialSuggestionImageUrl(sb, restaurantId, asset);
  if (!url) return null;
  return downloadBuffer(url);
}
