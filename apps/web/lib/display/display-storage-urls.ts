import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { rewriteAdminSignedStorageUrl } from "@/lib/auth/rewrite-admin-auth-action-link";
import { RESTAURANT_PROFILE_IMAGES_BUCKET } from "@/lib/restaurant/restaurant-profile-image";

export const DISPLAY_STAFF_AVATARS_BUCKET = "restaurant-staff-avatars";

/**
 * Display-Tablets bleiben oft stundenlang offen ohne Full-Reload.
 * Signed URLs müssen länger leben als der Public-Profil-Cache (1h).
 */
export const DISPLAY_STORAGE_SIGNED_URL_EXPIRES_IN = 60 * 60 * 12;

export async function signDisplayStorageUrl(
  admin: SupabaseClient,
  bucket: string,
  path: string | null | undefined,
  expiresIn = DISPLAY_STORAGE_SIGNED_URL_EXPIRES_IN,
): Promise<string | null> {
  const trimmed = path?.trim();
  if (!trimmed) return null;

  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(trimmed, expiresIn);

  if (error || !data?.signedUrl) return null;
  return rewriteAdminSignedStorageUrl(data.signedUrl);
}

export async function signRestaurantAvatarUrl(
  admin: SupabaseClient,
  path: string | null | undefined,
): Promise<string | null> {
  return signDisplayStorageUrl(admin, RESTAURANT_PROFILE_IMAGES_BUCKET, path);
}

export async function signStaffAvatarUrl(
  admin: SupabaseClient,
  path: string | null | undefined,
): Promise<string | null> {
  return signDisplayStorageUrl(admin, DISPLAY_STAFF_AVATARS_BUCKET, path);
}
