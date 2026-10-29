import "server-only";

import {
  NEWS_PLATFORM_LABELS,
  isNewsPlatform,
  type NewsPlatform,
} from "@/lib/constants/news-platforms";
import {
  newsEngagementTotal,
  newsReachTotal,
  parseNewsInsights,
  type NewsChannelInsightRow,
} from "@/lib/news/news-insights";
import type { NewsInsights } from "@/lib/news/unified-news-item";
import type { SupabaseClient } from "@supabase/supabase-js";

export type NewsPostChannelInsight = NewsChannelInsightRow & {
  status: string | null;
  externalId: string | null;
  externalUrl: string | null;
};

function insightsFromCacheItem(raw: unknown): NewsInsights | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const item = raw as { insights?: unknown };
  return parseNewsInsights(item.insights ?? null);
}

/**
 * Pro-Kanal Reichweite/Engagement für einen Gwada-News-Post
 * (Publications + Feed-Cache-Match über external_id).
 */
export async function loadNewsPostChannelInsights(
  sb: SupabaseClient,
  restaurantId: string,
  postId: string,
): Promise<NewsPostChannelInsight[]> {
  const { data: pubs, error } = await sb
    .from("gwada_news_publications")
    .select("platform, status, external_id, external_url, insights")
    .eq("restaurant_id", restaurantId)
    .eq("post_id", postId);

  if (error) {
    console.warn("[gwada] news post channel insights", error.message);
    return [];
  }

  const rows = pubs ?? [];
  if (rows.length === 0) return [];

  const cacheable = rows.filter(
    (row) =>
      typeof row.platform === "string" &&
      row.platform !== "gwada" &&
      typeof row.external_id === "string" &&
      row.external_id.trim().length > 0,
  );

  const cacheByKey = new Map<string, NewsInsights | null>();
  if (cacheable.length > 0) {
    const platforms = [
      ...new Set(cacheable.map((r) => r.platform as string)),
    ];
    const externalIds = [
      ...new Set(
        cacheable.map((r) => (r.external_id as string).trim()).filter(Boolean),
      ),
    ];
    const { data: cacheRows } = await sb
      .from("restaurant_news_platform_cache")
      .select("platform, external_id, item")
      .eq("restaurant_id", restaurantId)
      .in("platform", platforms)
      .in("external_id", externalIds);

    for (const row of cacheRows ?? []) {
      const platform = row.platform as string;
      const externalId = row.external_id as string;
      cacheByKey.set(`${platform}:${externalId}`, insightsFromCacheItem(row.item));
    }
  }

  const out: NewsPostChannelInsight[] = [];
  for (const row of rows) {
    const platformRaw = typeof row.platform === "string" ? row.platform : "";
    if (!isNewsPlatform(platformRaw)) continue;
    const platform = platformRaw as NewsPlatform;
    const externalId =
      typeof row.external_id === "string" && row.external_id.trim()
        ? row.external_id.trim()
        : null;
    const stored = parseNewsInsights(row.insights);
    const fromCache =
      externalId != null
        ? (cacheByKey.get(`${platform}:${externalId}`) ?? null)
        : null;
    const merged = mergeInsights(stored, fromCache);
    out.push({
      platform,
      label: NEWS_PLATFORM_LABELS[platform],
      posts: 1,
      reach: newsReachTotal(merged),
      engagement: newsEngagementTotal(merged),
      insights: merged,
      status: typeof row.status === "string" ? row.status : null,
      externalId,
      externalUrl:
        typeof row.external_url === "string" && row.external_url.trim()
          ? row.external_url.trim()
          : null,
    });
  }

  return out;
}

function mergeInsights(
  a: NewsInsights | null,
  b: NewsInsights | null,
): NewsInsights | null {
  if (!a && !b) return null;
  const out: NewsInsights = { ...(a ?? {}) };
  if (b) {
    for (const key of ["likes", "comments", "views", "shares", "reach"] as const) {
      if (out[key] == null && b[key] != null) out[key] = b[key];
      else if (out[key] != null && b[key] != null) {
        // Cache ist oft frischer — bevorzuge Cache bei Konflikt.
        out[key] = b[key];
      }
    }
  }
  return parseNewsInsights(out);
}

/** Schreibt Insights aus dem Feed-Cache in passende Publication-Zeilen. */
export async function syncPublicationInsightsFromCacheItems(
  admin: SupabaseClient,
  restaurantId: string,
  platform: NewsPlatform,
  items: Array<{ externalId: string; insights: NewsInsights | null }>,
): Promise<void> {
  if (platform === "gwada" || items.length === 0) return;

  await Promise.all(
    items.map(async ({ externalId, insights }) => {
      if (!externalId || !insights) return;
      const payload = parseNewsInsights(insights);
      if (!payload) return;
      await admin
        .from("gwada_news_publications")
        .update({
          insights: payload,
          last_synced_at: new Date().toISOString(),
        })
        .eq("restaurant_id", restaurantId)
        .eq("platform", platform)
        .eq("external_id", externalId);
    }),
  );
}
