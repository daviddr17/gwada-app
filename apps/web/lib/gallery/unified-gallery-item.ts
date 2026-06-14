import type { GalleryPlatform } from "@/lib/constants/gallery-platforms";

export type GalleryMediaKind = "image" | "video";

export type UnifiedGalleryItem = {
  id: string;
  platform: GalleryPlatform;
  source: "gwada" | "external";
  itemId: string | null;
  title: string | null;
  caption: string | null;
  category: string | null;
  categoryLabel: string | null;
  mediaKind: GalleryMediaKind;
  previewUrl: string;
  fullUrl: string | null;
  width: number | null;
  height: number | null;
  storagePath: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
  canEdit: boolean;
  canDelete: boolean;
  externalUrl: string | null;
  externalId: string;
  parentExternalId: string | null;
};

export type UnifiedGalleryHighlight = {
  id: string;
  platform: GalleryPlatform;
  title: string;
  coverUrl: string;
  itemIds: string[];
  items: UnifiedGalleryItem[];
};

export type GalleryFeedResponse = {
  items: UnifiedGalleryItem[];
  highlights: UnifiedGalleryHighlight[];
  categories: GalleryCategoryOption[];
};

export type GalleryCategoryOption = {
  key: string;
  label: string;
  platform: GalleryPlatform;
  count: number;
};
