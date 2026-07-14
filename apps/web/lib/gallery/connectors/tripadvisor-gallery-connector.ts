import "server-only";

import type { GalleryPlatformConnector } from "@/lib/gallery/connectors/types";
import type { UnifiedGalleryItem } from "@/lib/gallery/unified-gallery-item";
import {
  ensureTripadvisorAllowlistLocation,
  fetchTripadvisorApi,
  getTripadvisorLocationIdForRestaurant,
  TRIPADVISOR_DEFAULT_LOCALE,
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

type TripadvisorPhotoInfo = {
  original_size_url?: string;
  original_width?: number;
  original_height?: number;
  media_type?: string;
};

type TripadvisorPhotoRaw = {
  id?: number | string;
  caption?: string;
  published_date?: string;
  publish_ts?: string;
  photo?: TripadvisorPhotoInfo;
  images?: {
    thumbnail?: TripadvisorPhotoImageSize;
    small?: TripadvisorPhotoImageSize;
    medium?: TripadvisorPhotoImageSize;
    large?: TripadvisorPhotoImageSize;
    original?: TripadvisorPhotoImageSize;
  };
  url_original?: string;
  url_large?: string;
  url_medium?: string;
  url_small?: string;
  url_thumbnail?: string;
  url?: string;
};

type TripadvisorPhotosResponse = {
  data?: TripadvisorPhotoRaw[];
  photos?: TripadvisorPhotoRaw[];
  pagination?: {
    total_elements?: number;
  };
};

const TRIPADVISOR_PHOTOS_PAGE_SIZE = 50;
const TRIPADVISOR_PHOTOS_MAX_PAGES = 5;

function pickPhotoUrl(photo: TripadvisorPhotoRaw): {
  url: string;
  previewUrl: string;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
} | null {
  const terraUrl = photo.photo?.original_size_url?.trim();
  if (terraUrl) {
    return {
      url: terraUrl,
      previewUrl: terraUrl,
      thumbUrl: null,
      width: photo.photo?.original_width ?? null,
      height: photo.photo?.original_height ?? null,
    };
  }

  const images = photo.images;
  if (images) {
    const original = images.original?.url?.trim();
    const large = images.large?.url?.trim();
    const medium = images.medium?.url?.trim();
    const small = images.small?.url?.trim();
    const thumbnail = images.thumbnail?.url?.trim();
    const url = original ?? large ?? medium ?? small ?? thumbnail;
    if (url) {
      // Preview = scharf genug fürs Raster; Thumb nur für schnelles Blur-up.
      const previewSource = large ?? original ?? medium ?? small ?? thumbnail;
      const thumbSource = thumbnail ?? small ?? medium;
      const sizeSource =
        images.original ?? images.large ?? images.medium ?? images.small;
      return {
        url,
        previewUrl: previewSource ?? url,
        thumbUrl:
          thumbSource && thumbSource !== (previewSource ?? url)
            ? thumbSource
            : null,
        width: sizeSource?.width ?? null,
        height: sizeSource?.height ?? null,
      };
    }
  }

  const flatUrl =
    photo.url_original?.trim() ||
    photo.url_large?.trim() ||
    photo.url_medium?.trim() ||
    photo.url?.trim() ||
    photo.url_small?.trim() ||
    photo.url_thumbnail?.trim();
  if (!flatUrl) return null;

  const flatThumb =
    photo.url_thumbnail?.trim() ||
    photo.url_small?.trim() ||
    photo.url_medium?.trim() ||
    null;

  return {
    url: flatUrl,
    previewUrl: flatUrl,
    thumbUrl: flatThumb && flatThumb !== flatUrl ? flatThumb : null,
    width: null,
    height: null,
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
    thumbUrl: urls.thumbUrl,
    width: urls.width,
    height: urls.height,
    storagePath: null,
    mimeType: photo.photo?.media_type?.trim() || "image/jpeg",
    sizeBytes: null,
    createdAt: photo.publish_ts ?? photo.published_date ?? new Date().toISOString(),
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

    const allowlist = await ensureTripadvisorAllowlistLocation(auth.locationId);
    if ("error" in allowlist && allowlist.status === 403) {
      return { error: "tripadvisor_allowlist_denied" };
    }

    const items: UnifiedGalleryItem[] = [];

    for (let page = 1; page <= TRIPADVISOR_PHOTOS_MAX_PAGES; page++) {
      const result = await fetchTripadvisorApi<TripadvisorPhotosResponse>({
        path: `/locations/${encodeURIComponent(auth.locationId)}/photos`,
        locales: [TRIPADVISOR_DEFAULT_LOCALE],
        searchParams: {
          page,
          size: TRIPADVISOR_PHOTOS_PAGE_SIZE,
        },
      });
      if ("error" in result) {
        if (items.length === 0) return { error: result.error };
        break;
      }

      const rawPhotos = result.data.data ?? result.data.photos ?? [];
      const batch = rawPhotos
        .map(mapTripadvisorPhoto)
        .filter((item): item is UnifiedGalleryItem => item !== null);
      items.push(...batch);

      if (batch.length < TRIPADVISOR_PHOTOS_PAGE_SIZE) break;
    }

    return { items };
  },
};
