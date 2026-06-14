import "server-only";

import { galleryCategoryLabelForPlatform } from "@/lib/gallery/gallery-categories";
import type { GalleryPlatformConnector } from "@/lib/gallery/connectors/types";
import type { UnifiedGalleryItem } from "@/lib/gallery/unified-gallery-item";
import {
  getGoogleBusinessAccessTokenForRestaurant,
  googleReviewsParentPath,
} from "@/lib/integrations/google-business-access";

const CAPABILITIES = {
  canReadGallery: true,
  canUpload: true,
  canUpdate: false,
  canDelete: true,
  supportsVideo: true,
  supportsCategories: true,
} as const;

type GoogleMediaItem = {
  name?: string;
  mediaFormat?: string;
  googleUrl?: string;
  thumbnailUrl?: string;
  createTime?: string;
  locationAssociation?: { category?: string };
};

async function getGoogleLocation(restaurantId: string) {
  const auth = await getGoogleBusinessAccessTokenForRestaurant(restaurantId);
  if ("error" in auth) return { error: auth.error as string };
  const parent = googleReviewsParentPath(auth.config);
  if (!parent) return { error: "google_location_missing" };
  return { accessToken: auth.accessToken, parent };
}

function mapGoogleMedia(item: GoogleMediaItem): UnifiedGalleryItem | null {
  const id = item.name?.split("/").pop() ?? item.name ?? "";
  if (!id) return null;
  const url = item.googleUrl?.trim() || item.thumbnailUrl?.trim();
  if (!url) return null;
  const format = (item.mediaFormat ?? "PHOTO").toUpperCase();
  const category = item.locationAssociation?.category ?? null;
  return {
    id: `google_business:${id}`,
    platform: "google_business",
    source: "external",
    itemId: null,
    title: null,
    caption: null,
    category,
    categoryLabel: galleryCategoryLabelForPlatform("google_business", category),
    mediaKind: format === "VIDEO" ? "video" : "image",
    previewUrl: item.thumbnailUrl?.trim() || url,
    fullUrl: url,
    width: null,
    height: null,
    storagePath: null,
    mimeType: format === "VIDEO" ? "video/mp4" : "image/jpeg",
    sizeBytes: null,
    createdAt: item.createTime ?? new Date().toISOString(),
    canEdit: false,
    canDelete: true,
    externalUrl: url,
    externalId: id,
    parentExternalId: null,
  };
}

export const googleBusinessGalleryConnector: GalleryPlatformConnector = {
  key: "google_business",
  displayName: "Google",
  capabilities: CAPABILITIES,
  async isConnected(restaurantId) {
    const auth = await getGoogleLocation(restaurantId);
    return !("error" in auth);
  },
  async fetchGalleryItems(restaurantId, _sb) {
    const auth = await getGoogleLocation(restaurantId);
    if ("error" in auth) return { error: auth.error ?? "google_not_connected" };

    const url = `https://mybusiness.googleapis.com/v4/${auth.parent}/media`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      cache: "no-store",
    });
    const body = (await res.json()) as {
      mediaItems?: GoogleMediaItem[];
      error?: { message?: string };
    };
    if (!res.ok) {
      return { error: body.error?.message ?? `google_media_${res.status}` };
    }

    const items = (body.mediaItems ?? [])
      .map(mapGoogleMedia)
      .filter((item): item is UnifiedGalleryItem => item !== null);

    return { items };
  },
  async uploadItem(restaurantId, _sb, input) {
    const auth = await getGoogleLocation(restaurantId);
    if ("error" in auth) return { ok: false, error: auth.error ?? "google_not_connected" };

    const res = await fetch(
      `https://mybusiness.googleapis.com/v4/${auth.parent}/media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mediaFormat: input.mimeType.startsWith("video/") ? "VIDEO" : "PHOTO",
          locationAssociation: input.category
            ? { category: input.category }
            : undefined,
          sourceUrl: input.mediaUrl,
        }),
      },
    );
    const body = (await res.json()) as GoogleMediaItem & {
      error?: { message?: string };
    };
    if (!res.ok) {
      return { ok: false, error: body.error?.message ?? `google_media_upload_${res.status}` };
    }
    const externalId = body.name?.split("/").pop() ?? null;
    return {
      ok: true,
      externalId,
      externalUrl: body.googleUrl ?? null,
    };
  },
  async deleteItem(restaurantId, _sb, externalId) {
    const auth = await getGoogleLocation(restaurantId);
    if ("error" in auth) return { ok: false, error: auth.error ?? "google_not_connected" };

    const name = `${auth.parent}/media/${externalId}`;
    const res = await fetch(`https://mybusiness.googleapis.com/v4/${name}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return { ok: false, error: body.error?.message ?? `google_media_delete_${res.status}` };
    }
    return { ok: true };
  },
};
