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
  album?: string;
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
  /** Contributor avatar (nicht Galerieinhalt). */
  user?: {
    username?: string;
    avatar?: {
      url?: string;
      thumbnail?: string | TripadvisorPhotoImageSize;
      small?: string | TripadvisorPhotoImageSize;
    };
  };
};

type TripadvisorPhotosResponse = {
  data?: TripadvisorPhotoRaw[];
  photos?: TripadvisorPhotoRaw[];
  pagination?: {
    total_elements?: number;
  };
};

/** Terra: max. `size` ist 25 (`'size' should not go over 25`). */
const TRIPADVISOR_PHOTOS_PAGE_SIZE = 25;
const TRIPADVISOR_PHOTOS_MAX_PAGES = 10;

/** Unter dieser Kantenlänge wirken TA-Thumbs wie Profil-Avatare (50×50 / 150×150). */
const MIN_GALLERY_EDGE_PX = 200;

const PROFILE_ALBUM_RE =
  /profil|profile|avatar|member|contributor|benutzer/i;

function imageSizeUrl(
  value: string | TripadvisorPhotoImageSize | undefined,
): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  return value.url?.trim() || null;
}

function maxEdge(size: TripadvisorPhotoImageSize | undefined): number {
  if (!size) return 0;
  return Math.max(size.width ?? 0, size.height ?? 0);
}

function isLikelyProfileAlbum(album: string | undefined): boolean {
  const value = album?.trim();
  if (!value) return false;
  return PROFILE_ALBUM_RE.test(value);
}

function pickPhotoUrl(photo: TripadvisorPhotoRaw): {
  url: string;
  previewUrl: string;
  thumbUrl: string | null;
  width: number | null;
  height: number | null;
} | null {
  if (isLikelyProfileAlbum(photo.album)) return null;

  const terraUrl = photo.photo?.original_size_url?.trim();
  const terraW = photo.photo?.original_width ?? null;
  const terraH = photo.photo?.original_height ?? null;
  if (terraUrl) {
    const edge = Math.max(terraW ?? 0, terraH ?? 0);
    if (edge > 0 && edge < MIN_GALLERY_EDGE_PX) return null;
    return {
      url: terraUrl,
      previewUrl: terraUrl,
      thumbUrl: null,
      width: terraW,
      height: terraH,
    };
  }

  const images = photo.images;
  if (images) {
    const ranked: { size: TripadvisorPhotoImageSize; kind: string }[] = [
      { size: images.original, kind: "original" },
      { size: images.large, kind: "large" },
      { size: images.medium, kind: "medium" },
      { size: images.small, kind: "small" },
      { size: images.thumbnail, kind: "thumbnail" },
    ].filter((entry): entry is { size: TripadvisorPhotoImageSize; kind: string } =>
      Boolean(entry.size?.url?.trim()),
    );

    // Nie Thumbnail/Small als einzige Display-Quelle: wirkt wie Profilbild.
    const displayCandidate =
      ranked.find(
        (entry) =>
          entry.kind === "original" ||
          entry.kind === "large" ||
          entry.kind === "medium" ||
          maxEdge(entry.size) >= MIN_GALLERY_EDGE_PX,
      ) ?? null;

    if (!displayCandidate) return null;

    const url = displayCandidate.size.url!.trim();
    const thumbCandidate =
      ranked.find(
        (entry) =>
          entry.size.url?.trim() &&
          entry.size.url.trim() !== url &&
          (entry.kind === "thumbnail" ||
            entry.kind === "small" ||
            entry.kind === "medium"),
      ) ?? null;

    return {
      url,
      previewUrl: url,
      thumbUrl: thumbCandidate?.size.url?.trim() || null,
      width: displayCandidate.size.width ?? null,
      height: displayCandidate.size.height ?? null,
    };
  }

  const flatCandidates = [
    { url: photo.url_original?.trim(), edge: 1600 },
    { url: photo.url_large?.trim(), edge: 550 },
    { url: photo.url_medium?.trim(), edge: 250 },
    { url: photo.url?.trim(), edge: 250 },
  ].filter((entry): entry is { url: string; edge: number } => Boolean(entry.url));

  const display = flatCandidates.find((entry) => entry.edge >= MIN_GALLERY_EDGE_PX);
  if (!display) return null;

  const flatThumb =
    photo.url_thumbnail?.trim() ||
    photo.url_small?.trim() ||
    null;

  return {
    url: display.url,
    previewUrl: display.url,
    thumbUrl: flatThumb && flatThumb !== display.url ? flatThumb : null,
    width: null,
    height: null,
  };
}

function mapTripadvisorPhoto(photo: TripadvisorPhotoRaw): UnifiedGalleryItem | null {
  const id = photo.id != null ? String(photo.id) : "";
  if (!id) return null;

  const urls = pickPhotoUrl(photo);
  if (!urls) return null;

  // Abwehr: falls die gewählte URL doch die Contributor-Avatar-URL ist.
  const avatarUrl =
    imageSizeUrl(photo.user?.avatar?.url) ||
    imageSizeUrl(photo.user?.avatar?.thumbnail) ||
    imageSizeUrl(photo.user?.avatar?.small);
  if (avatarUrl && (urls.url === avatarUrl || urls.previewUrl === avatarUrl)) {
    return null;
  }

  return {
    id: `tripadvisor:${id}`,
    platform: "tripadvisor",
    source: "external",
    itemId: null,
    title: null,
    caption: photo.caption?.trim() || null,
    category: photo.album?.trim() || null,
    categoryLabel: photo.album?.trim() || null,
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

      if (rawPhotos.length < TRIPADVISOR_PHOTOS_PAGE_SIZE) break;
    }

    return { items };
  },
};
