import "server-only";

import { galleryCategoryLabelForPlatform } from "@/lib/gallery/gallery-categories";
import type { GalleryPlatformConnector } from "@/lib/gallery/connectors/types";
import type { UnifiedGalleryItem } from "@/lib/gallery/unified-gallery-item";
import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
import { metaGraphListFetch } from "@/lib/news/connectors/meta-feed-fetch";
import {
  igMediaKind,
  igMediaPreviewUrl,
  proxyInstagramNewsMediaUrl,
  type IgMedia,
} from "@/lib/news/connectors/instagram-media-map";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";

const CAPABILITIES = {
  canReadGallery: true,
  canUpload: false,
  canUpdate: false,
  canDelete: false,
  supportsVideo: true,
  supportsCategories: true,
} as const;

const IG_TAG_FIELDS =
  "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}";

async function getIgAuth(restaurantId: string) {
  const row = await fetchRestaurantOAuthIntegrationAdmin(
    restaurantId,
    "instagram",
    (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
  );
  if (!row || row.status !== "working") return { error: "instagram_not_connected" as const };
  const igId = row.config.instagram_business_account_id?.trim();
  const token = row.config.page_access_token?.trim();
  if (!igId || !token) return { error: "instagram_token_missing" as const };
  return { igId, token, restaurantId };
}

function expandIgMediaToGalleryItems(
  restaurantId: string,
  media: IgMedia,
): UnifiedGalleryItem[] {
  const category = "tagged";
  const categoryLabel = galleryCategoryLabelForPlatform("instagram", category);
  const parentId = media.id?.trim() ?? null;
  const createdAt = media.timestamp ?? new Date().toISOString();
  const caption = media.caption?.trim() ?? null;
  const permalink = media.permalink ?? null;

  const children = media.children?.data ?? [];
  if (children.length > 0) {
    const expanded: UnifiedGalleryItem[] = [];
    for (const [index, child] of children.entries()) {
      const childUrl =
        child.media_url?.trim() || child.thumbnail_url?.trim() || null;
      if (!childUrl || !parentId) continue;
      const childType = (child.media_type ?? "").toUpperCase();
      const kind = childType === "VIDEO" ? "video" : "image";
      const childId = `${parentId}_${index}`;
      expanded.push({
        id: `instagram:${childId}`,
        platform: "instagram",
        source: "external",
        itemId: null,
        title: null,
        caption,
        category,
        categoryLabel,
        mediaKind: kind,
        previewUrl: proxyInstagramNewsMediaUrl(restaurantId, childUrl),
        fullUrl: proxyInstagramNewsMediaUrl(restaurantId, childUrl),
        width: null,
        height: null,
        storagePath: null,
        mimeType: kind === "video" ? "video/mp4" : "image/jpeg",
        sizeBytes: null,
        createdAt,
        canEdit: false,
        canDelete: false,
        externalUrl: permalink,
        externalId: childId,
        parentExternalId: parentId,
      });
    }
    return expanded;
  }

  const previewUrl = igMediaPreviewUrl(media);
  if (!previewUrl || !parentId) return [];
  const kind = igMediaKind(media);
  return [
    {
      id: `instagram:${parentId}`,
      platform: "instagram",
      source: "external",
      itemId: null,
      title: null,
      caption,
      category,
      categoryLabel,
      mediaKind: kind,
      previewUrl: proxyInstagramNewsMediaUrl(restaurantId, previewUrl),
      fullUrl: proxyInstagramNewsMediaUrl(restaurantId, previewUrl),
      width: null,
      height: null,
      storagePath: null,
      mimeType: kind === "video" ? "video/mp4" : "image/jpeg",
      sizeBytes: null,
      createdAt,
      canEdit: false,
      canDelete: false,
      externalUrl: permalink,
      externalId: parentId,
      parentExternalId: null,
    },
  ];
}

export const instagramGalleryConnector: GalleryPlatformConnector = {
  key: "instagram",
  displayName: "Instagram",
  capabilities: CAPABILITIES,
  async isConnected(restaurantId) {
    const auth = await getIgAuth(restaurantId);
    return !("error" in auth);
  },
  async fetchGalleryItems(restaurantId, _sb) {
    const auth = await getIgAuth(restaurantId);
    if ("error" in auth) return { error: auth.error ?? "instagram_not_connected" };

    const result = await metaGraphListFetch<IgMedia>({
      path: `${auth.igId}/tags?fields=${encodeURIComponent(IG_TAG_FIELDS)}&limit=50`,
      token: auth.token,
      context: { platform: "instagram", feature: "gallery" },
    });

    if (!result.ok) return { error: result.error ?? "instagram_tags_failed" };

    const items = result.data.flatMap((media) =>
      expandIgMediaToGalleryItems(restaurantId, media),
    );
    return { items };
  },
};
