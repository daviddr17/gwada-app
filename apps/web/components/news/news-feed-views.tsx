"use client";

import { memo, useCallback } from "react";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import { NEWS_PLATFORM_LABELS } from "@/lib/constants/news-platforms";
import { formatNewsCardDate, newsDisplayTimestamp } from "@/lib/news/format-news-display-date";
import { NewsInsightsBadges } from "@/components/news/news-insights-badges";
import { NewsPlatformIcon } from "@/components/news/news-platform-icon";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const NewsCard = memo(function NewsCard({
  item,
  onClick,
  masonry = false,
}: {
  item: UnifiedNewsItem;
  onClick?: () => void;
  /** Abstand + break-inside für CSS-Columns (Pinterest). */
  masonry?: boolean;
}) {
  const preview = item.media[0];
  const dateLabel = formatNewsCardDate(item);
  const dateTime = newsDisplayTimestamp(item);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-xl border border-border/50 bg-card text-left shadow-card transition hover:border-border",
        masonry && "mb-4 break-inside-avoid",
        onClick && "cursor-pointer hover:shadow-card active:scale-[0.99]",
      )}
    >
      {preview?.url ? (
        <div className="relative w-full shrink-0 bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.url}
            alt=""
            loading="lazy"
            decoding="async"
            className="block max-h-80 w-full object-cover"
          />
        </div>
      ) : null}
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <NewsPlatformIcon platform={item.platform} className="size-3" />
              {NEWS_PLATFORM_LABELS[item.platform]}
            </Badge>
            {item.insights ? <NewsInsightsBadges insights={item.insights} /> : null}
          </div>
          <time
            className="shrink-0 text-xs text-muted-foreground"
            dateTime={dateTime}
          >
            {dateLabel}
          </time>
        </div>
        {item.title ? (
          <p className="font-medium leading-snug">{item.title}</p>
        ) : null}
        {item.body ? (
          <p className="line-clamp-4 text-sm text-muted-foreground">{item.body}</p>
        ) : null}
      </div>
    </button>
  );
});

const NewsFeedCardRow = memo(function NewsFeedCardRow({
  item,
  masonry,
  onItemClick,
}: {
  item: UnifiedNewsItem;
  masonry?: boolean;
  onItemClick?: (item: UnifiedNewsItem) => void;
}) {
  const onClick = useCallback(() => {
    onItemClick?.(item);
  }, [item, onItemClick]);

  return <NewsCard item={item} masonry={masonry} onClick={onItemClick ? onClick : undefined} />;
});

export function NewsMasonryGrid({
  items,
  onItemClick,
}: {
  items: UnifiedNewsItem[];
  onItemClick?: (item: UnifiedNewsItem) => void;
}) {
  return (
    <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4 [contain:layout]">
      {items.map((item) => (
        <NewsFeedCardRow key={item.id} item={item} masonry onItemClick={onItemClick} />
      ))}
    </div>
  );
}

export function NewsListView({
  items,
  onItemClick,
}: {
  items: UnifiedNewsItem[];
  onItemClick?: (item: UnifiedNewsItem) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <NewsFeedCardRow key={item.id} item={item} onItemClick={onItemClick} />
      ))}
    </div>
  );
}
