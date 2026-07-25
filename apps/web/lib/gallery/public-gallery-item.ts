import type { GalleryPlatform } from "@/lib/constants/gallery-platforms";
import type {
  UnifiedGalleryHighlight,
  UnifiedGalleryItem,
} from "@/lib/gallery/unified-gallery-item";

/**
 * Öffentliche Galerie-Payload schlank halten — kein Staff-Feld, kein doppeltes
 * fullUrl, kein blurDataUrl (Base64). 1000 Items sonst ~1.2 MB+.
 */
export function toPublicGalleryItem(item: UnifiedGalleryItem): UnifiedGalleryItem {
  const previewUrl = item.previewUrl;
  const full = item.fullUrl?.trim() || null;
  const thumb = item.thumbUrl?.trim() || null;
  return {
    id: item.id,
    platform: item.platform,
    source: item.source,
    itemId: item.itemId,
    title: item.title,
    caption: item.caption,
    category: item.category,
    categoryLabel: item.categoryLabel,
    mediaKind: item.mediaKind,
    previewUrl,
    fullUrl: full && full !== previewUrl ? full : null,
    thumbUrl: thumb && thumb !== previewUrl ? thumb : null,
    width: item.width,
    height: item.height,
    storagePath: null,
    mimeType: null,
    sizeBytes: null,
    createdAt: item.createdAt,
    canEdit: false,
    canDelete: false,
    externalUrl: item.externalUrl,
    externalId: item.externalId,
    parentExternalId: item.parentExternalId,
    isPinned: item.isPinned,
  };
}

export function toPublicGalleryHighlight(
  highlight: UnifiedGalleryHighlight,
): UnifiedGalleryHighlight {
  return {
    ...highlight,
    items: highlight.items.map(toPublicGalleryItem),
  };
}

export function collectGalleryPlatforms(
  items: UnifiedGalleryItem[],
): GalleryPlatform[] {
  const set = new Set<GalleryPlatform>(["gwada"]);
  for (const item of items) set.add(item.platform);
  return [...set];
}
