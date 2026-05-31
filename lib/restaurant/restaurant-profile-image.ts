import type { SupabaseClient } from "@supabase/supabase-js";

export const RESTAURANT_PROFILE_IMAGES_BUCKET = "restaurant-profile-images";

export type RestaurantProfileImageKind = "avatar" | "cover";

export function restaurantProfileImageStoragePath(params: {
  restaurantId: string;
  kind: RestaurantProfileImageKind;
  ext: string;
}): string {
  const safeExt = params.ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  return `${params.restaurantId}/${params.kind}.${safeExt}`;
}

export async function resolveRestaurantProfileImageSignedUrl(
  sb: SupabaseClient,
  path: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  const trimmed = path?.trim();
  if (!trimmed) return null;

  const { data, error } = await sb.storage
    .from(RESTAURANT_PROFILE_IMAGES_BUCKET)
    .createSignedUrl(trimmed, expiresIn);

  if (error || !data?.signedUrl) {
    console.warn("[gwada] resolveRestaurantProfileImageSignedUrl", error?.message);
    return null;
  }

  return data.signedUrl;
}
