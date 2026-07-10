import "server-only";

import type { NewsMediaPreview } from "@/lib/news/unified-news-item";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type NewsMediaRow = {
  id: string;
  kind: "image" | "video";
  storagePath: string;
  mimeType: string;
  sortOrder: number;
  width?: number | null;
  height?: number | null;
  thumbStoragePath?: string | null;
  blurDataUrl?: string | null;
};

export function parseNewsMedia(raw: unknown): NewsMediaRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: NewsMediaRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : null;
    const storagePath = typeof o.storagePath === "string" ? o.storagePath : null;
    const kind = o.kind === "video" ? "video" : o.kind === "image" ? "image" : null;
    if (!id || !storagePath || !kind) continue;
    rows.push({
      id,
      kind,
      storagePath,
      mimeType: typeof o.mimeType === "string" ? o.mimeType : "application/octet-stream",
      sortOrder: typeof o.sortOrder === "number" ? o.sortOrder : rows.length,
      width: typeof o.width === "number" ? o.width : null,
      height: typeof o.height === "number" ? o.height : null,
      thumbStoragePath:
        typeof o.thumbStoragePath === "string" ? o.thumbStoragePath : null,
      blurDataUrl: typeof o.blurDataUrl === "string" ? o.blurDataUrl : null,
    });
  }
  return rows.sort((a, b) => a.sortOrder - b.sortOrder);
}

export function newsMediaToPreview(
  media: NewsMediaRow[],
  signedUrls: Map<string, string>,
): NewsMediaPreview[] {
  return media.map((m) => ({
    id: m.id,
    kind: m.kind,
    storagePath: m.storagePath,
    mimeType: m.mimeType,
    sortOrder: m.sortOrder,
    url: signedUrls.get(m.storagePath) ?? null,
    thumbUrl: m.thumbStoragePath
      ? (signedUrls.get(m.thumbStoragePath) ?? null)
      : null,
    width: m.width ?? null,
    height: m.height ?? null,
    blurDataUrl: m.blurDataUrl ?? null,
  }));
}

export const NEWS_MEDIA_BUCKET = "news-media";

export function buildNewsMediaStoragePath(params: {
  restaurantId: string;
  postId: string;
  fileName: string;
}): string {
  const safe = params.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return `${params.restaurantId}/${params.postId}/${Date.now()}_${safe}`;
}

export function buildNewsMediaVariantPath(params: {
  restaurantId: string;
  postId: string;
  mediaId: string;
  variant: "preview" | "thumb";
}): string {
  return `${params.restaurantId}/${params.postId}/${params.mediaId}_${params.variant}.webp`;
}

export async function resolveNewsMediaSignedUrls(
  storagePaths: string[],
  expiresIn = 7200,
): Promise<string[]> {
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const urls: string[] = [];
  for (const path of storagePaths) {
    const { data } = await admin.storage
      .from(NEWS_MEDIA_BUCKET)
      .createSignedUrl(path, expiresIn);
    if (data?.signedUrl) urls.push(data.signedUrl);
  }
  return urls;
}
