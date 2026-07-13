import "server-only";

import type { GalleryPlatformConnector } from "@/lib/gallery/connectors/types";
import type { UnifiedGalleryItem } from "@/lib/gallery/unified-gallery-item";
import {
  fetchTripadvisorApi,
  getTripadvisorLocationIdForRestaurant,
} from "@/lib/integrations/tripadvisor-api-client";

const CAPABILITIES = {
  canReadGallery: true,
  canUpload: false,
  canUpdate: false,
  canDelete: false,
  supportsVideo: false,
  supportsCategories: false,
} as const;

type TripadvisorPhotoImageSize = {
  url?: string;
  width?: number;
  height?: number;
};

type TripadvisorPhotoRaw = {
  id?: number | string;
  caption?: string;
  published_date?: string;
  images?: {
    thumbnail?: TripadvisorPhotoImageSize;
    small?: TripadvisorPhotoImageSize;
    medium?: TripadvisorPhotoImageSize;
    large?: TripadvisorPhotoImageSize;
    original?: TripadvisorPhotoImageSize;
  };
};

type TripadvisorPhotosResponse = {
  data?: TripadvisorPhotoRaw[];
};

const TRIPADVISOR_PHOTOS_PAGE_SIZE = 50;
const TRIPADVISOR_PHOTOS_MAX_PAGES = 5;

function pickPhotoUrl(photo: TripadvisorPhotoRaw): {
  url: string;
  previewUrl: string;
  width: number | null;
  height: number | null;
} | null {
  const images = photo.images;
  if (!images) return null;

  const original = images.original?.url?.trim();
  const large = images.large?.url?.trim();
  const medium = images.medium?.url?.trim();
  const small = images.small?.url?.trim();
  const thumbnail = images.thumbnail?.url?.trim();
  const url = original ?? large ?? medium ?? small ?? thumbnail;
  if (!url) return null;

  const previewSource = thumbnail ?? small ?? medium ?? large ?? original;
  const sizeSource = images.original ?? images.large ?? images.medium ?? images.small;

  return {
    url,
    previewUrl: previewSource ?? url,
    width: sizeSource?.width ?? null,
    height: sizeSource?.height ?? null,
  };
}

function mapTripadvisorPhoto(photo: TripadvisorPhotoRaw): UnifiedGalleryItem | null {
  const id = photo.id != null ? String(photo.id) : "";
  if (!id) return null;

  const urls = pickPhotoUrl(photo);
  if (!urls) return null;

  return {
    id: `tripadvisor:${id}`,
    platform: "tripadvisor",
    source: "external",
    itemId: null,
    title: null,
    caption: photo.caption?.trim() || null,
    category: null,
    categoryLabel: null,
    mediaKind: "image",
    previewUrl: urls.previewUrl,
    fullUrl: urls.url,
    width: urls.width,
    height: urls.height,
    storagePath: null,
    mimeType: "image/jpeg",
    sizeBytes: null,
    createdAt: photo.published_date ?? new Date().toISOString(),
    canEdit: false,
    canDelete: false,
    externalUrl: urls.url,
    externalId: id,
    parentExternalId: null,
  };
}

export const tripadvisorGalleryConnector: GalleryPlatformConnector = {
  key: "tripadvisor",
  displayName: "TripAdvisor",
  capabilities: CAPABILITIES,
  async isConnected(restaurantId) {
    const auth = await getTripadvisorLocationIdForRestaurant(restaurantId);
    return !("error" in auth);
  },
  async fetchGalleryItems(restaurantId) {
    const auth = await getTripadvisorLocationIdForRestaurant(restaurantId);
    if ("error" in auth) return { error: auth.error };

    const items: UnifiedGalleryItem[] = [];

    for (let page = 1; page <= TRIPADVISOR_PHOTOS_MAX_PAGES; page++) {
      const result = await fetchTripadvisorApi<TripadvisorPhotosResponse>({
        path: `/locations/${encodeURIComponent(auth.locationId)}/photos`,
        searchParams: {
          page,
          size: TRIPADVISOR_PHOTOS_PAGE_SIZE,
        },
      });
      if ("error" in result) {
        if (items.length === 0) return { error: result.error };
        break;
      }

      const batch = (result.data.data ?? [])
        .map(mapTripadvisorPhoto)
        .filter((item): item is UnifiedGalleryItem => item !== null);
      items.push(...batch);

      if (batch.length < TRIPADVISOR_PHOTOS_PAGE_SIZE) break;
    }

    return { items };
  },
};
