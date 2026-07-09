import "server-only";

import {
  shareChannelDefinition,
  type ShareChannelKey,
} from "@/lib/constants/share-channels";
import { publishFacebookStory } from "@/lib/news/connectors/facebook-stories";
import { publishInstagramStory } from "@/lib/news/connectors/instagram-stories";
import { getNewsConnector } from "@/lib/news/connectors/registry";
import type { NewsPublishInput } from "@/lib/news/connectors/types";
import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
import { syncRestaurantNewsPlatformAfterPublish } from "@/lib/news/news-feed-sync-server";
import { syncRestaurantNewsStoriesAfterPublish } from "@/lib/news/news-stories-sync-server";
import type { NewsPlatform } from "@/lib/constants/news-platforms";
import type { SharePublishChannelResult } from "@/lib/share/share-types";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";
import type { SupabaseClient } from "@supabase/supabase-js";

function composeShareBody(body: string, link?: string | null): string {
  const trimmed = body.trim();
  const linkTrimmed = link?.trim();
  if (!linkTrimmed || trimmed.includes(linkTrimmed)) return trimmed;
  return trimmed ? `${trimmed}\n\n${linkTrimmed}` : linkTrimmed;
}

async function publishShareStory(
  restaurantId: string,
  platform: "facebook" | "instagram",
  imageUrl: string,
): Promise<SharePublishChannelResult> {
  const storyInput = { imageUrl };

  if (platform === "instagram") {
    const row = await fetchRestaurantOAuthIntegrationAdmin(
      restaurantId,
      "instagram",
      (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
    );
    const igId = row?.config.instagram_business_account_id?.trim();
    const token = row?.config.page_access_token?.trim();
    if (!igId || !token) {
      return { ok: false, error: "instagram_not_connected" };
    }
    const result = await publishInstagramStory({ igId, token }, storyInput);
    if (result.ok) {
      void syncRestaurantNewsStoriesAfterPublish(restaurantId, platform);
      return { ok: true };
    }
    return { ok: false, error: result.error };
  }

  const row = await fetchRestaurantOAuthIntegrationAdmin(
    restaurantId,
    "facebook",
    (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
  );
  const pageId = row?.config.page_id?.trim();
  const token = row?.config.page_access_token?.trim();
  if (!pageId || !token) {
    return { ok: false, error: "facebook_not_connected" };
  }
  const result = await publishFacebookStory({ pageId, token }, storyInput);
  if (result.ok) {
    void syncRestaurantNewsStoriesAfterPublish(restaurantId, platform);
    return { ok: true };
  }
  return { ok: false, error: result.error };
}

async function publishSharePost(
  restaurantId: string,
  sb: SupabaseClient,
  platform: NewsPlatform,
  input: NewsPublishInput,
): Promise<SharePublishChannelResult> {
  const connector = getNewsConnector(platform);
  if (!connector.publishPost) {
    return { ok: false, error: "platform_not_supported" };
  }
  const result = await connector.publishPost(restaurantId, sb, input);
  if (result.ok) {
    void syncRestaurantNewsPlatformAfterPublish(restaurantId, platform);
    return { ok: true, externalUrl: result.externalUrl };
  }
  return { ok: false, error: result.error };
}

export async function publishShareToChannels(params: {
  restaurantId: string;
  sb: SupabaseClient;
  title: string | null;
  body: string;
  imageUrls: string[];
  link?: string | null;
  channels: ShareChannelKey[];
}): Promise<
  | {
      ok: true;
      results: Partial<Record<ShareChannelKey, SharePublishChannelResult>>;
    }
  | { ok: false; error: string }
> {
  const uniqueChannels = [...new Set(params.channels)];
  if (uniqueChannels.length === 0) {
    return { ok: false, error: "no_channels_selected" };
  }

  const composedBody = composeShareBody(params.body, params.link);
  if (!composedBody.trim()) {
    return { ok: false, error: "body_required" };
  }

  const publishInput: NewsPublishInput = {
    title: params.title?.trim() || null,
    body: composedBody,
    mediaStoragePaths: [],
    mediaUrls: params.imageUrls.filter(Boolean),
    scheduledAt: null,
  };

  const results: Partial<Record<ShareChannelKey, SharePublishChannelResult>> =
    {};

  for (const channelKey of uniqueChannels) {
    const def = shareChannelDefinition(channelKey);

    if (def.requiresImage && publishInput.mediaUrls.length === 0) {
      results[channelKey] = { ok: false, error: "image_required" };
      continue;
    }

    if (def.kind === "story") {
      const imageUrl = publishInput.mediaUrls[0];
      if (!imageUrl) {
        results[channelKey] = { ok: false, error: "image_required" };
        continue;
      }
      if (def.platform !== "facebook" && def.platform !== "instagram") {
        results[channelKey] = { ok: false, error: "platform_not_supported" };
        continue;
      }
      results[channelKey] = await publishShareStory(
        params.restaurantId,
        def.platform,
        imageUrl,
      );
      continue;
    }

    results[channelKey] = await publishSharePost(
      params.restaurantId,
      params.sb,
      def.platform,
      publishInput,
    );
  }

  const successCount = Object.values(results).filter((r) => r?.ok).length;
  if (successCount === 0) {
    const firstError =
      Object.values(results).find((r) => r && !r.ok)?.error ??
      "publish_failed";
    return { ok: false, error: firstError };
  }

  return { ok: true, results };
}
