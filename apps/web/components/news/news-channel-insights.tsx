"use client";

import { MousePointerClick, Users } from "lucide-react";
import { NewsPlatformIcon } from "@/components/news/news-platform-icon";
import { NewsInsightsBadges } from "@/components/news/news-insights-badges";
import {
  newsEngagementTotal,
  newsInsightsHasValues,
  newsReachTotal,
  type NewsChannelInsightRow,
} from "@/lib/news/news-insights";
import type { NewsInsights } from "@/lib/news/unified-news-item";
import { formatInsightCount } from "@/lib/insights/platform-insights-types";
import { cn } from "@/lib/utils";

function MetricChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
      title={label}
      aria-label={`${formatInsightCount(value)} ${label}`}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="tabular-nums">{formatInsightCount(value)}</span>
    </span>
  );
}

export function NewsChannelInsightsList({
  channels,
  className,
  compact = false,
}: {
  channels: NewsChannelInsightRow[];
  className?: string;
  /** Kompakte Zeile (Posting-Sheet unter Plattform-Chips). */
  compact?: boolean;
}) {
  const visible = channels.filter(
    (row) =>
      row.reach != null ||
      row.engagement != null ||
      newsInsightsHasValues(row.insights) ||
      (compact && row.posts > 0 && row.platform !== "gwada"),
  );
  if (visible.length === 0) return null;

  return (
    <ul className={cn("space-y-2", className)} aria-label="Insights pro Kanal">
      {visible.map((row) => {
        const reach = row.reach ?? newsReachTotal(row.insights);
        const engagement = row.engagement ?? newsEngagementTotal(row.insights);
        return (
          <li
            key={row.platform}
            className={cn(
              "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border/50 bg-muted/20 px-3 py-2",
              compact && "py-1.5",
            )}
          >
            <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium">
              <NewsPlatformIcon platform={row.platform} className="size-4 shrink-0" />
              <span className="truncate">{row.label}</span>
            </span>
            <span className="flex flex-wrap items-center gap-2.5 sm:ml-auto">
              {reach != null ? (
                <MetricChip icon={Users} label="Reichweite" value={reach} />
              ) : null}
              {engagement != null ? (
                <MetricChip
                  icon={MousePointerClick}
                  label="Engagement"
                  value={engagement}
                />
              ) : null}
              {compact && reach == null && engagement == null && row.posts > 0 ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {row.posts} Beiträge
                </span>
              ) : null}
              {!compact && row.insights ? (
                <NewsInsightsBadges insights={row.insights} />
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Einzelkanal aus flachen Post-Insights (externe Feed-Items). */
export function newsChannelRowFromItemInsights(
  platform: NewsChannelInsightRow["platform"],
  label: string,
  insights: NewsInsights | null,
): NewsChannelInsightRow | null {
  if (!newsInsightsHasValues(insights)) return null;
  return {
    platform,
    label,
    posts: 1,
    reach: newsReachTotal(insights),
    engagement: newsEngagementTotal(insights),
    insights,
  };
}
