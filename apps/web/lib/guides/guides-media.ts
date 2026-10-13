import "server-only";

import { rewriteAdminSignedStorageUrl } from "@/lib/auth/rewrite-admin-auth-action-link";
import { GUIDES_MEDIA_BUCKET } from "@/lib/constants/guides-media";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export function buildGuidesMediaStoragePath(params: {
  restaurantId: string;
  guideId: string;
  stepId: string;
  fileName: string;
}): string {
  const safe = params.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return `${params.restaurantId}/${params.guideId}/${params.stepId}/${Date.now()}_${safe}`;
}

export async function resolveGuidesMediaSignedUrl(
  storagePath: string,
  expiresIn = 7200,
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin.storage
    .from(GUIDES_MEDIA_BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  return data?.signedUrl
    ? rewriteAdminSignedStorageUrl(data.signedUrl)
    : null;
}

export async function resolveGuidesMediaSignedUrls(
  storagePaths: string[],
  expiresIn = 7200,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(storagePaths.filter(Boolean))];
  await Promise.all(
    unique.map(async (path) => {
      const url = await resolveGuidesMediaSignedUrl(path, expiresIn);
      if (url) map.set(path, url);
    }),
  );
  return map;
}
