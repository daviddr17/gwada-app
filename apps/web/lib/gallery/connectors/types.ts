import "server-only";

import type { GalleryPlatform } from "@/lib/constants/gallery-platforms";
import type { UnifiedGalleryItem } from "@/lib/gallery/unified-gallery-item";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GalleryConnectorCapabilities = {
  canReadGallery: boolean;
  canUpload: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  supportsVideo: boolean;
  supportsCategories: boolean;
};

export type GalleryUploadInput = {
  title: string | null;
  caption: string | null;
  category: string | null;
  mediaUrl: string;
  mimeType: string;
};

export type GalleryUploadResult =
  | {
      ok: true;
      externalId: string | null;
      externalUrl: string | null;
    }
  | { ok: false; error: string };

export interface GalleryPlatformConnector {
  key: GalleryPlatform;
  displayName: string;
  capabilities: GalleryConnectorCapabilities;
  isConnected(restaurantId: string): Promise<boolean>;
  fetchGalleryItems(
    restaurantId: string,
    sb: SupabaseClient,
  ): Promise<{ items: UnifiedGalleryItem[] } | { error: string }>;
  uploadItem?(
    restaurantId: string,
    sb: SupabaseClient,
    input: GalleryUploadInput,
  ): Promise<GalleryUploadResult>;
  updateItem?(
    restaurantId: string,
    sb: SupabaseClient,
    externalId: string,
    input: Partial<GalleryUploadInput>,
  ): Promise<GalleryUploadResult>;
  deleteItem?(
    restaurantId: string,
    sb: SupabaseClient,
    externalId: string,
  ): Promise<{ ok: true } | { ok: false; error: string }>;
}
