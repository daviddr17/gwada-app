import {
  NEWS_PLATFORM_LABELS,
  NEWS_PLATFORM_ORDER,
  type NewsPlatform,
} from "@/lib/constants/news-platforms";
import type { NewsInsights, UnifiedNewsItem } from "@/lib/news/unified-news-item";

export type NewsChannelInsightRow = {
  platform: NewsPlatform;
  label: string;
  /** Beiträge im Zeitraum / auf dem Kanal. */
  posts: number;
  reach: number | null;
  engagement: number | null;
  insights: NewsInsights | null;
};

export function parseNewsInsights(raw: unknown): NewsInsights | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: NewsInsights = {};
  for (const key of ["likes", "comments", "views", "shares", "reach"] as const) {
    const v = o[key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      out[key] = Math.round(v);
    }
  }
  if (
    out.likes == null &&
    out.comments == null &&
    out.views == null &&
    out.shares == null &&
    out.reach == null
  ) {
    return null;
  }
  return out;
}

/** Engagement = Likes + Kommentare + Shares (Interaktionen). */
export function newsEngagementTotal(insights: NewsInsights | null | undefined): number | null {
  if (!insights) return null;
  let sum = 0;
  let any = false;
  for (const key of ["likes", "comments", "shares"] as const) {
    const v = insights[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      sum += v;
      any = true;
    }
  }
  return any ? sum : null;
}

/** Reichweite: explizit `reach`, sonst `views` als Näherung. */
export function newsReachTotal(insights: NewsInsights | null | undefined): number | null {
  if (!insights) return null;
  if (typeof insights.reach === "number" && Number.isFinite(insights.reach)) {
    return insights.reach;
  }
  if (typeof insights.views === "number" && Number.isFinite(insights.views)) {
    return insights.views;
  }
  return null;
}

export function newsInsightsHasValues(insights: NewsInsights | null | undefined): boolean {
  if (!insights) return false;
  return (
    insights.likes != null ||
    insights.comments != null ||
    insights.views != null ||
    insights.shares != null ||
    insights.reach != null
  );
}

/**
 * Aggregiert Reichweite/Engagement je Kanal aus News-Feed-Items
 * (für Plattform-Hinweise im Posting-Sheet).
 */
export function computeNewsChannelInsights(
  items: UnifiedNewsItem[],
): NewsChannelInsightRow[] {
  const byPlatform = new Map<
    NewsPlatform,
    {
      posts: number;
      likes: number;
      comments: number;
      shares: number;
      views: number;
      reach: number;
      hasLikes: boolean;
      hasComments: boolean;
      hasShares: boolean;
      hasViews: boolean;
      hasReach: boolean;
    }
  >();

  for (const item of items) {
    const bucket = byPlatform.get(item.platform) ?? {
      posts: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      views: 0,
      reach: 0,
      hasLikes: false,
      hasComments: false,
      hasShares: false,
      hasViews: false,
      hasReach: false,
    };
    bucket.posts += 1;
    const insights = item.insights;
    if (insights) {
      if (typeof insights.likes === "number") {
        bucket.likes += insights.likes;
        bucket.hasLikes = true;
      }
      if (typeof insights.comments === "number") {
        bucket.comments += insights.comments;
        bucket.hasComments = true;
      }
      if (typeof insights.shares === "number") {
        bucket.shares += insights.shares;
        bucket.hasShares = true;
      }
      if (typeof insights.views === "number") {
        bucket.views += insights.views;
        bucket.hasViews = true;
      }
      if (typeof insights.reach === "number") {
        bucket.reach += insights.reach;
        bucket.hasReach = true;
      }
    }
    byPlatform.set(item.platform, bucket);
  }

  const rows: NewsChannelInsightRow[] = [];
  for (const platform of NEWS_PLATFORM_ORDER) {
    const bucket = byPlatform.get(platform);
    if (!bucket || bucket.posts === 0) continue;

    const insights: NewsInsights = {};
    if (bucket.hasLikes) insights.likes = bucket.likes;
    if (bucket.hasComments) insights.comments = bucket.comments;
    if (bucket.hasShares) insights.shares = bucket.shares;
    if (bucket.hasViews) insights.views = bucket.views;
    if (bucket.hasReach) insights.reach = bucket.reach;

    const parsed = parseNewsInsights(insights);
    rows.push({
      platform,
      label: NEWS_PLATFORM_LABELS[platform],
      posts: bucket.posts,
      reach: newsReachTotal(parsed),
      engagement: newsEngagementTotal(parsed),
      insights: parsed,
    });
  }
  return rows;
}

export function serializeNewsInsights(insights: NewsInsights | null): Record<string, number> {
  if (!insights) return {};
  const out: Record<string, number> = {};
  for (const key of ["likes", "comments", "views", "shares", "reach"] as const) {
    const v = insights[key];
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      out[key] = Math.round(v);
    }
  }
  return out;
}
