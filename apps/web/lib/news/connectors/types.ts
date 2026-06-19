import "server-only";

import type { NewsPlatform } from "@/lib/constants/news-platforms";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NewsConnectorCapabilities = {
  canReadFeed: boolean;
  canReadStories: boolean;
  canCreatePost: boolean;
  canPublishStory: boolean;
  canUpdatePost: boolean;
  canDeletePost: boolean;
  canReadInsights: boolean;
  supportsNativeScheduling: boolean;
  supportsVideo: boolean;
  maxMediaCount: number;
};

export type NewsPublishInput = {
  title: string | null;
  body: string;
  mediaStoragePaths: string[];
  mediaUrls: string[];
  scheduledAt: string | null;
  platformConfig?: Record<string, unknown>;
};

export type NewsPublishResult =
  | {
      ok: true;
      externalId: string | null;
      externalUrl: string | null;
      publishedAt: string | null;
    }
  | { ok: false; error: string };

export type { NewsConnectorPublicInfo } from "@/lib/types/news-connectors";

export interface NewsPlatformConnector {
  key: NewsPlatform;
  displayName: string;
  capabilities: NewsConnectorCapabilities;
  isConnected(restaurantId: string): Promise<boolean>;
  fetchFeed(
    restaurantId: string,
    sb: SupabaseClient,
  ): Promise<{ items: UnifiedNewsItem[] } | { error: string }>;
  publishPost?(
    restaurantId: string,
    sb: SupabaseClient,
    input: NewsPublishInput,
  ): Promise<NewsPublishResult>;
  updatePost?(
    restaurantId: string,
    sb: SupabaseClient,
    externalId: string,
    input: Partial<NewsPublishInput>,
  ): Promise<NewsPublishResult>;
  deletePost?(
    restaurantId: string,
    sb: SupabaseClient,
    externalId: string,
  ): Promise<{ ok: true } | { ok: false; error: string }>;
  externalEditUrl(externalId: string | null): string | null;
}
