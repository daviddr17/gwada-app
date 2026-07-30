import "server-only";

import { rewriteAdminSignedStorageUrl } from "@/lib/auth/rewrite-admin-auth-action-link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const EVENTS_MEDIA_BUCKET = "events-media";

export function buildEventsMediaStoragePath(params: {
  restaurantId: string;
  eventId: string;
  fileName: string;
}): string {
  const safe = params.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return `${params.restaurantId}/${params.eventId}/${Date.now()}_${safe}`;
}

export async function resolveEventsCoverSignedUrl(
  storagePath: string | null,
  expiresIn = 7200,
): Promise<string | null> {
  if (!storagePath?.trim()) return null;
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin.storage
    .from(EVENTS_MEDIA_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  return data?.signedUrl
    ? rewriteAdminSignedStorageUrl(data.signedUrl)
    : null;
}
