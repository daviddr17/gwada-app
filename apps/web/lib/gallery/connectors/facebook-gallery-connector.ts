import "server-only";

import { galleryCategoryLabelForPlatform } from "@/lib/gallery/gallery-categories";
import type { GalleryPlatformConnector } from "@/lib/gallery/connectors/types";
import type { UnifiedGalleryItem } from "@/lib/gallery/unified-gallery-item";
import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
import {
  metaGraphListFetchAll,
} from "@/lib/news/connectors/meta-feed-fetch";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";

const CAPABILITIES = {
  canReadGallery: true,
  canUpload: true,
  canUpdate: false,
  canDelete: true,
  supportsVideo: true,
  supportsCategories: true,
} as const;

/** Meta-System-Alben (Timeline, Cover, Profil …) — keine Beitrags-Fotos. */
const FACEBOOK_SYSTEM_ALBUM_TYPES = new Set([
  "cover",
  "profile",
  "mobile",
  "wall",
  "community",
  "app",
]);

/** Exakte Album-Namen (EN/DE), die Beitrags-/Chronik-Fotos enthalten. */
const FACEBOOK_EXCLUDED_ALBUM_NAME =
  /^(timeline photos|chronik(?:-|\s*)fotos?|cover photos|coverfotos|titelfotos|profile pictures|profilfotos|mobile uploads|wall photos|stream photos)$/i;

type FbAlbum = {
  id?: string;
  name?: string;
  type?: string;
};

type FbPhoto = {
  id?: string;
  name?: string;
  created_time?: string;
  page_story_id?: string;
  link?: string;
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

function isExcludedFacebookAlbum(album: FbAlbum): boolean {
  const type = album.type?.trim().toLowerCase();
  if (type && FACEBOOK_SYSTEM_ALBUM_TYPES.has(type)) return true;

  const name = album.name?.trim() ?? "";
  if (!name) return true;
  if (FACEBOOK_EXCLUDED_ALBUM_NAME.test(name)) return true;

  const lower = name.toLowerCase();
  return (
    lower.includes("chronik") ||
    lower.includes("timeline") ||
    lower.includes("titelfoto") ||
    lower.includes("coverfoto") ||
    lower.includes("profilfoto") ||
    lower.includes("profile picture") ||
    lower.includes("wall photo") ||
    lower.includes("mobile upload") ||
    lower.includes("beitrag") ||
    lower.includes("beitrags") ||
    lower.includes("post photo") ||
    lower.includes("stream photo")
  );
}

/** Fotos, die über einen Page-Beitrag veröffentlicht wurden — gehören in News, nicht Galerie. */
function isFacebookPostPhoto(photo: FbPhoto): boolean {
  if (photo.page_story_id?.trim()) return true;
  const link = photo.link?.trim().toLowerCase() ?? "";
  return link.includes("/posts/") || link.includes("/videos/") || link.includes("/permalink/");
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

const PHOTO_FIELDS = encodeURIComponent(
  "id,name,created_time,images,page_story_id,link,album",
);

async function fetchAlbumPhotos(
  auth: { token: string },
  albumId: string,
  albumName: string,
): Promise<UnifiedGalleryItem[]> {
  const result = await metaGraphListFetchAll<FbPhoto>({
    path: `${albumId}/photos?fields=${PHOTO_FIELDS}&limit=100`,
    token: auth.token,
    context: { platform: "facebook", feature: "gallery" },
    maxPages: 8,
  });
  if (!result.ok) return [];

  const items: UnifiedGalleryItem[] = [];
  for (const photo of result.data) {
    if (isFacebookPostPhoto(photo)) continue;
    const mapped = mapFbPhoto(photo, albumName);
    if (mapped) items.push(mapped);
  }
  return items;
}

async function fetchFacebookGalleryPhotos(
  auth: { pageId: string; token: string },
): Promise<{ items: UnifiedGalleryItem[] } | { error: string }> {
  const albumResult = await metaGraphListFetchAll<FbAlbum>({
    path: `${auth.pageId}/albums?fields=${encodeURIComponent("id,name,type")}&limit=50`,
    token: auth.token,
    context: { platform: "facebook", feature: "gallery" },
    maxPages: 6,
  });

  if (!albumResult.ok) {
    return { error: albumResult.error ?? "facebook_albums_failed" };
  }

  const items: UnifiedGalleryItem[] = [];
  for (const album of albumResult.data) {
    const albumId = album.id?.trim();
    const albumName = album.name?.trim() ?? "";
    if (!albumId || isExcludedFacebookAlbum(album)) continue;
    const albumItems = await fetchAlbumPhotos(auth, albumId, albumName);
    items.push(...albumItems);
  }

  if (items.length === 0) {
    return { items: [] };
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
