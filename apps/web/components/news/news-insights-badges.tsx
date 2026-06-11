"use client";

import { Eye, Heart, MessageCircle, Share2 } from "lucide-react";
import type { NewsInsights } from "@/lib/news/unified-news-item";
import { cn } from "@/lib/utils";

function InsightStat({
  icon: Icon,
  value,
  label,
  className,
}: {
  icon: typeof Heart;
  value: number;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-muted-foreground",
        className,
      )}
      title={label}
      aria-label={`${value} ${label}`}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span>{value}</span>
    </span>
  );
}

export function NewsInsightsBadges({
  insights,
  className,
}: {
  insights: NewsInsights;
  className?: string;
}) {
  const hasLikes = insights.likes != null;
  const hasComments = insights.comments != null;
  const hasViews = insights.views != null;
  const hasShares = insights.shares != null;
  if (!hasLikes && !hasComments && !hasViews && !hasShares) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {hasLikes ? (
        <InsightStat icon={Heart} value={insights.likes!} label="Likes" />
      ) : null}
      {hasComments ? (
        <InsightStat icon={MessageCircle} value={insights.comments!} label="Kommentare" />
      ) : null}
      {hasViews ? (
        <InsightStat icon={Eye} value={insights.views!} label="Aufrufe" />
      ) : null}
      {hasShares ? (
        <InsightStat icon={Share2} value={insights.shares!} label="Geteilt" />
      ) : null}
    </div>
  );
}
