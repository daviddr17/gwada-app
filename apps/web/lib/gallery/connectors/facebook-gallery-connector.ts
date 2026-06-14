import "server-only";

import { galleryCategoryLabelForPlatform } from "@/lib/gallery/gallery-categories";
import type { GalleryPlatformConnector } from "@/lib/gallery/connectors/types";
import type { UnifiedGalleryItem } from "@/lib/gallery/unified-gallery-item";
import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
import { metaGraphListFetch } from "@/lib/news/connectors/meta-feed-fetch";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";

const CAPABILITIES = {
  canReadGallery: true,
  canUpload: true,
  canUpdate: false,
  canDelete: true,
  supportsVideo: true,
  supportsCategories: true,
} as const;

/** Album-Namen, die Timeline-/Beitrags-Fotos enthalten — nicht in der Galerie. */
const FACEBOOK_EXCLUDED_ALBUM_NAME =
  /^(timeline photos|chronik(?:-fotos)?|cover photos|titelfotos|profile pictures|profilfotos|mobile uploads|wall photos)$/i;

type FbPhoto = {
  id?: string;
  name?: string;
  created_time?: string;
  images?: Array<{ source?: string; width?: number; height?: number }>;
  album?: { id?: string; name?: string };
};

async function getMetaAuth(restaurantId: string) {
  const row = await fetchRestaurantOAuthIntegrationAdmin(
    restaurantId,
    "facebook",
    (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
  );
  if (!row || row.status !== "working") return { error: "facebook_not_connected" as const };
  const pageId = row.config.page_id?.trim();
  const token = row.config.page_access_token?.trim();
  if (!pageId || !token) return { error: "facebook_token_missing" as const };
  return { pageId, token };
}

function fbPhotoUrl(photo: FbPhoto): string | null {
  const images = photo.images ?? [];
  if (images.length === 0) return null;
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return sorted[0]?.source?.trim() ?? null;
}

function mapFbPhoto(photo: FbPhoto, category: string | null): UnifiedGalleryItem | null {
  const id = photo.id?.trim();
  const url = fbPhotoUrl(photo);
  if (!id || !url) return null;
  const categoryKey = category ?? photo.album?.name ?? null;
  return {
    id: `facebook:${id}`,
    platform: "facebook",
    source: "external",
    itemId: null,
    title: photo.name?.trim() ?? null,
    caption: photo.name?.trim() ?? null,
    category: categoryKey,
    categoryLabel: galleryCategoryLabelForPlatform("facebook", categoryKey),
    mediaKind: "image",
    previewUrl: url,
    fullUrl: url,
    width: photo.images?.[0]?.width ?? null,
    height: photo.images?.[0]?.height ?? null,
    storagePath: null,
    mimeType: "image/jpeg",
    sizeBytes: null,
    createdAt: photo.created_time ?? new Date().toISOString(),
    canEdit: false,
    canDelete: true,
    externalUrl: `https://www.facebook.com/photo.php?fbid=${id}`,
    externalId: id,
    parentExternalId: null,
  };
}

function dedupeFacebookItems(items: UnifiedGalleryItem[]): UnifiedGalleryItem[] {
  const seen = new Set<string>();
  const out: UnifiedGalleryItem[] = [];
  for (const item of items) {
    if (seen.has(item.externalId)) continue;
    seen.add(item.externalId);
    out.push(item);
  }
  return out;
}

async function fetchFacebookGalleryPhotos(
  auth: { pageId: string; token: string },
): Promise<{ items: UnifiedGalleryItem[] } | { error: string }> {
  const items: UnifiedGalleryItem[] = [];

  const photosResult = await metaGraphListFetch<FbPhoto>({
    path: `${auth.pageId}/photos?type=uploaded&fields=${encodeURIComponent("id,name,created_time,images")}&limit=100`,
    token: auth.token,
    context: { platform: "facebook", feature: "gallery" },
  });
  if (photosResult.ok) {
    for (const photo of photosResult.data) {
      const mapped = mapFbPhoto(photo, null);
      if (mapped) items.push(mapped);
    }
  } else if (items.length === 0) {
    return { error: photosResult.error ?? "facebook_photos_failed" };
  }

  const albumResult = await metaGraphListFetch<{ id?: string; name?: string; photos?: { data?: FbPhoto[] } }>({
    path: `${auth.pageId}/albums?fields=${encodeURIComponent("id,name,photos{id,name,created_time,images}")}&limit=50`,
    token: auth.token,
    context: { platform: "facebook", feature: "gallery" },
  });

  if (albumResult.ok) {
    for (const album of albumResult.data) {
      const albumName = album.name?.trim() ?? "";
      if (!albumName || FACEBOOK_EXCLUDED_ALBUM_NAME.test(albumName)) continue;
      for (const photo of album.photos?.data ?? []) {
        const mapped = mapFbPhoto(photo, albumName);
        if (mapped) items.push(mapped);
      }
    }
  }

  if (items.length === 0 && !photosResult.ok) {
    return { error: photosResult.error ?? "facebook_photos_failed" };
  }

  return { items: dedupeFacebookItems(items) };
}

export const facebookGalleryConnector: GalleryPlatformConnector = {
  key: "facebook",
  displayName: "Facebook",
  capabilities: CAPABILITIES,
  async isConnected(restaurantId) {
    const auth = await getMetaAuth(restaurantId);
    return !("error" in auth);
  },
  async fetchGalleryItems(restaurantId, _sb) {
    const auth = await getMetaAuth(restaurantId);
    if ("error" in auth) return { error: auth.error as string };

    const result = await fetchFacebookGalleryPhotos(auth);
    if ("error" in result) return { error: result.error };
    return { items: result.items };
  },
  async uploadItem(restaurantId, _sb, input) {
    const auth = await getMetaAuth(restaurantId);
    if ("error" in auth) return { ok: false, error: auth.error ?? "facebook_not_connected" };

    const params = new URLSearchParams({
      url: input.mediaUrl,
      published: "true",
    });
    if (input.caption?.trim()) params.set("caption", input.caption.trim());

    const res = await fetch(
      `https://graph.facebook.com/v22.0/${auth.pageId}/photos?${params.toString()}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.token}` },
      },
    );
    const body = (await res.json()) as { id?: string; error?: { message?: string } };
    if (!res.ok) {
      return { ok: false, error: body.error?.message ?? `facebook_photo_upload_${res.status}` };
    }
    return {
      ok: true,
      externalId: body.id ?? null,
      externalUrl: body.id ? `https://www.facebook.com/photo.php?fbid=${body.id}` : null,
    };
  },
  async deleteItem(restaurantId, _sb, externalId) {
    const auth = await getMetaAuth(restaurantId);
    if ("error" in auth) return { ok: false, error: auth.error ?? "facebook_not_connected" };

    const res = await fetch(
      `https://graph.facebook.com/v22.0/${externalId}?access_token=${encodeURIComponent(auth.token)}`,
      { method: "DELETE" },
    );
    const body = (await res.json()) as { success?: boolean; error?: { message?: string } };
    if (!res.ok || body.success === false) {
      return { ok: false, error: body.error?.message ?? `facebook_photo_delete_${res.status}` };
    }
    return { ok: true };
  },
};
