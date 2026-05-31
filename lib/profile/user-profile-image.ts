import type { SupabaseClient } from "@supabase/supabase-js";

export const USER_PROFILE_IMAGES_BUCKET = "user-profile-images";

export type UserProfileImageKind = "avatar" | "cover";

export function userProfileImageStoragePath(params: {
  userId: string;
  kind: UserProfileImageKind;
  ext: string;
}): string {
  const safeExt = params.ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  return `${params.userId}/${params.kind}.${safeExt}`;
}

export async function resolveUserProfileImageSignedUrl(
  sb: SupabaseClient,
  path: string | null | undefined,
  expiresIn = 3600,
): Promise<string | null> {
  const trimmed = path?.trim();
  if (!trimmed) return null;

  const { data, error } = await sb.storage
    .from(USER_PROFILE_IMAGES_BUCKET)
    .createSignedUrl(trimmed, expiresIn);

  if (error || !data?.signedUrl) {
    console.warn("[gwada] resolveUserProfileImageSignedUrl", error?.message);
    return null;
  }

  return data.signedUrl;
}
