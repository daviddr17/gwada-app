import type { SupabaseClient } from "@supabase/supabase-js";
import { rewriteAdminSignedStorageUrl } from "@/lib/auth/rewrite-admin-auth-action-link";

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

  return rewriteAdminSignedStorageUrl(data.signedUrl);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Profilbild als Data-URL — ohne Cross-Origin-Fetch (html2canvas/PDF). */
export async function downloadRestaurantProfileImageAsDataUrl(
  sb: SupabaseClient,
  path: string | null | undefined,
): Promise<string | null> {
  const trimmed = path?.trim();
  if (!trimmed) return null;

  const { data, error } = await sb.storage
    .from(RESTAURANT_PROFILE_IMAGES_BUCKET)
    .download(trimmed);

  if (error || !data?.size) {
    console.warn("[gwada] downloadRestaurantProfileImageAsDataUrl", error?.message);
    return null;
  }

  try {
    return await blobToDataUrl(data);
  } catch {
    return null;
  }
}
