"use client";

import { memo, useCallback, useState, type MouseEvent } from "react";
import { ExternalLink } from "lucide-react";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import { NEWS_PLATFORM_LABELS } from "@/lib/constants/news-platforms";
import { formatNewsCardDate, newsDisplayTimestamp } from "@/lib/news/format-news-display-date";
import { NewsInsightsBadges } from "@/components/news/news-insights-badges";
import { NewsPlatformIcon } from "@/components/news/news-platform-icon";
import { Badge } from "@/components/ui/badge";
import { FeedPinnedBadge } from "@/components/feed-pin/feed-pinned-badge";
import { feedPinnedItemSurfaceClassName } from "@/lib/ui/feed-pin-styles";
import { cn } from "@/lib/utils";

const PREVIEW_BODY_CHAR_THRESHOLD = 200;
const PREVIEW_BODY_LINE_THRESHOLD = 4;

export function newsBodyNeedsExpand(body: string): boolean {
  const trimmed = body.trim();
  if (trimmed.length > PREVIEW_BODY_CHAR_THRESHOLD) return true;
  return trimmed.split("\n").length > PREVIEW_BODY_LINE_THRESHOLD;
}

const newsCardSurfaceClassName =
  "flex w-full flex-col overflow-hidden rounded-xl border border-border/50 bg-card text-left shadow-card transition hover:border-border";

const NewsCard = memo(function NewsCard({
  item,
  onClick,
  inlineExpandBody = false,
  masonry = false,
}: {
  item: UnifiedNewsItem;
  onClick?: () => void;
  inlineExpandBody?: boolean;
  /** Abstand + break-inside für CSS-Columns (Pinterest). */
  masonry?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const preview = item.media[0];
  const dateLabel = formatNewsCardDate(item);
  const dateTime = newsDisplayTimestamp(item);
  const canExpandBody = inlineExpandBody && newsBodyNeedsExpand(item.body);
  const showClampedBody = canExpandBody && !expanded;
  const externalUrl = item.externalUrl?.trim() || null;

  const toggleExpanded = useCallback((event: MouseEvent) => {
    event.stopPropagation();
    setExpanded((value) => !value);
  }, []);

  const bodyBlock = item.body ? (
    <div className="space-y-1.5">
      <p
        className={cn(
          "text-sm text-muted-foreground",
          showClampedBody ? "line-clamp-4" : "whitespace-pre-wrap",
        )}
      >
        {item.body}
      </p>
      {canExpandBody || (expanded && externalUrl) ? (
        <div className="flex flex-col items-start gap-1.5">
          {canExpandBody ? (
            <button
              type="button"
              onClick={toggleExpanded}
              className="text-xs font-medium text-accent hover:underline"
            >
              {expanded ? "Weniger" : "Mehr anzeigen"}
            </button>
          ) : null}
          {expanded && externalUrl ? (
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
            >
              <ExternalLink className="size-3.5 shrink-0" />
              Auf {NEWS_PLATFORM_LABELS[item.platform]} öffnen
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  ) : null;

  const cardContent = (
    <>
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
            {item.isPinned ? <FeedPinnedBadge /> : null}
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
        {bodyBlock}
      </div>
    </>
  );

  const surfaceClassName = cn(
    newsCardSurfaceClassName,
    masonry && "mb-4 break-inside-avoid",
    item.isPinned && feedPinnedItemSurfaceClassName,
    onClick && "cursor-pointer hover:shadow-card active:scale-[0.99]",
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={surfaceClassName}>
        {cardContent}
      </button>
    );
  }

  return <article className={surfaceClassName}>{cardContent}</article>;
});

const NewsFeedCardRow = memo(function NewsFeedCardRow({
  item,
  onItemClick,
  inlineExpandBody,
  masonry,
}: {
  item: UnifiedNewsItem;
  onItemClick?: (item: UnifiedNewsItem) => void;
  inlineExpandBody?: boolean;
  masonry?: boolean;
}) {
  const onClick = useCallback(() => {
    onItemClick?.(item);
  }, [item, onItemClick]);

  const expandInline = Boolean(inlineExpandBody && !onItemClick);

  return (
    <NewsCard
      item={item}
      onClick={onItemClick ? onClick : undefined}
      inlineExpandBody={expandInline}
      masonry={masonry}
    />
  );
});

/** Pinterest-Raster: CSS-Columns, neueste links oben. */
export function NewsMasonryGrid({
  items,
  onItemClick,
  inlineExpandBody = onItemClick == null,
}: {
  items: UnifiedNewsItem[];
  onItemClick?: (item: UnifiedNewsItem) => void;
  /** Profil & Einbindung: Text per „Mehr anzeigen“ in der Karte aufklappen (kein Drawer). */
  inlineExpandBody?: boolean;
}) {
  return (
    <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4 [contain:layout]">
      {items.map((item) => (
        <NewsFeedCardRow
          key={item.id}
          item={item}
          masonry
          onItemClick={onItemClick}
          inlineExpandBody={inlineExpandBody}
        />
      ))}
    </div>
  );
}

/** @deprecated Alias — bitte `NewsMasonryGrid` verwenden. */
export const NewsGridView = NewsMasonryGrid;

export function NewsListView({
  items,
  onItemClick,
  inlineExpandBody = onItemClick == null,
}: {
  items: UnifiedNewsItem[];
  onItemClick?: (item: UnifiedNewsItem) => void;
  inlineExpandBody?: boolean;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <NewsFeedCardRow
          key={item.id}
          item={item}
          onItemClick={onItemClick}
          inlineExpandBody={inlineExpandBody}
        />
      ))}
    </div>
  );
}
