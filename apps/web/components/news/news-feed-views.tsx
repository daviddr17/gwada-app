"use client";

import { Fragment, memo, useCallback, useMemo, useState, type MouseEvent } from "react";
import { ExternalLink, Newspaper } from "lucide-react";
import { FeedMediaImage } from "@/components/feed/feed-media-image";
import type { UnifiedNewsItem } from "@/lib/news/unified-news-item";
import { NEWS_PLATFORM_LABELS } from "@/lib/constants/news-platforms";
import {
  formatNewsCardDate,
  formatNewsTimelineDay,
  formatNewsTimelineMonthShort,
  formatNewsTimelineMonthYear,
  newsDisplayTimestamp,
  newsTimelineSameMonthYear,
} from "@/lib/news/format-news-display-date";
import {
  newsBodyNeedsExpand,
  newsCardPreviewBody,
} from "@/lib/news/news-feed-preview";
import { stripMarkdownBold } from "@/lib/changelog/changelog-entry-normalize";
import { NewsInsightsBadges } from "@/components/news/news-insights-badges";
import { NewsPlatformIcon } from "@/components/news/news-platform-icon";
import { Badge } from "@/components/ui/badge";
import { FeedPinnedBadge } from "@/components/feed-pin/feed-pinned-badge";
import { feedPinnedItemSurfaceClassName } from "@/lib/ui/feed-pin-styles";
import { feedNewsGridClassName } from "@/lib/feed/feed-media-layout";
import { cn } from "@/lib/utils";

export { newsBodyNeedsExpand } from "@/lib/news/news-feed-preview";

const newsFeedExternalLinkChipClassName =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-border hover:bg-muted/40";

function NewsFeedBodyActions({
  canExpandBody,
  expanded,
  externalUrl,
  platform,
  onToggleExpanded,
}: {
  canExpandBody: boolean;
  expanded: boolean;
  externalUrl: string | null;
  platform: UnifiedNewsItem["platform"];
  onToggleExpanded: (event: MouseEvent) => void;
}) {
  if (!canExpandBody && !(expanded && externalUrl)) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
      {canExpandBody ? (
        <button
          type="button"
          onClick={onToggleExpanded}
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
          aria-label={`Auf ${NEWS_PLATFORM_LABELS[platform]} öffnen`}
          className={cn(
            newsFeedExternalLinkChipClassName,
            !canExpandBody && "ml-auto",
          )}
        >
          <NewsPlatformIcon platform={platform} className="size-3" />
          {NEWS_PLATFORM_LABELS[platform]}
          <ExternalLink className="size-3 opacity-70" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}

const timelineRowSurfaceClassName =
  "flex min-w-0 flex-1 gap-3 rounded-xl border border-border/50 bg-card p-3 text-left shadow-card transition sm:gap-4 sm:p-3.5";

const timelineThumbClassName =
  "size-[4.5rem] shrink-0 overflow-hidden rounded-lg bg-muted/30 sm:size-20";

const NewsTimelineThumb = memo(function NewsTimelineThumb({
  item,
}: {
  item: UnifiedNewsItem;
}) {
  const preview = item.media[0];
  const mediaSrc = preview?.url ?? preview?.thumbUrl ?? null;
  const [coverBroken, setCoverBroken] = useState(false);
  const showCover = Boolean(mediaSrc) && !coverBroken;

  if (showCover) {
    return (
      <div className={timelineThumbClassName}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mediaSrc!}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover object-center"
          onError={() => setCoverBroken(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        timelineThumbClassName,
        "flex items-center justify-center text-muted-foreground/70",
      )}
      aria-hidden
    >
      <Newspaper className="size-6 sm:size-7" />
    </div>
  );
});

const NewsTimelineRow = memo(function NewsTimelineRow({
  item,
  onClick,
  inlineExpandBody = false,
  showConnectorBelow,
}: {
  item: UnifiedNewsItem;
  onClick?: () => void;
  inlineExpandBody?: boolean;
  showConnectorBelow: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const previewBody = useMemo(() => newsCardPreviewBody(item.body), [item.body]);
  const canExpandBody = inlineExpandBody && newsBodyNeedsExpand(item.body);
  const showClampedBody = canExpandBody && !expanded;
  const externalUrl = item.externalUrl?.trim() || null;
  const dateTime = newsDisplayTimestamp(item);
  const dateLabel = formatNewsCardDate(item);

  const toggleExpanded = useCallback((event: MouseEvent) => {
    event.stopPropagation();
    setExpanded((value) => !value);
  }, []);

  const bodyBlock = item.body ? (
    <div className="space-y-1">
      <p
        data-embed-mt
        className={cn(
          "text-sm text-muted-foreground",
          showClampedBody ? "line-clamp-2" : inlineExpandBody ? "whitespace-pre-wrap" : "line-clamp-2",
        )}
      >
        {inlineExpandBody && expanded
          ? stripMarkdownBold(item.body)
          : previewBody}
      </p>
      {canExpandBody || (expanded && externalUrl) ? (
        <NewsFeedBodyActions
          canExpandBody={canExpandBody}
          expanded={expanded}
          externalUrl={externalUrl}
          platform={item.platform}
          onToggleExpanded={toggleExpanded}
        />
      ) : null}
    </div>
  ) : null;

  const body = (
    <>
      <div className="relative flex w-14 shrink-0 flex-col items-center self-stretch sm:w-16">
        <div className="z-10 flex w-full flex-col items-center rounded-lg border border-border/40 bg-background px-1 py-1.5 text-center">
          <span className="text-xl font-semibold tabular-nums leading-none sm:text-2xl">
            {formatNewsTimelineDay(dateTime)}
          </span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {formatNewsTimelineMonthShort(dateTime)}
          </span>
        </div>
        {showConnectorBelow ? (
          <div className="mt-1 w-px min-h-3 flex-1 bg-border/60" aria-hidden />
        ) : null}
      </div>

      <div
        className={cn(
          timelineRowSurfaceClassName,
          item.isPinned && feedPinnedItemSurfaceClassName,
          onClick && "group-hover/row:border-border group-active/row:scale-[0.995]",
        )}
      >
        <NewsTimelineThumb item={item} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="gap-1.5">
                <NewsPlatformIcon platform={item.platform} className="size-3" />
                {NEWS_PLATFORM_LABELS[item.platform]}
              </Badge>
              {item.isPinned ? <FeedPinnedBadge /> : null}
              {item.insights ? <NewsInsightsBadges insights={item.insights} /> : null}
            </div>
            <time
              className="shrink-0 text-xs text-muted-foreground tabular-nums"
              dateTime={dateTime}
            >
              {dateLabel}
            </time>
          </div>
          {item.title ? (
            <p className="font-medium leading-snug" data-embed-mt>
              {item.title}
            </p>
          ) : null}
          {bodyBlock}
        </div>
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group/row flex w-full gap-3 text-left sm:gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {body}
      </button>
    );
  }

  return <article className="flex w-full gap-3 sm:gap-4">{body}</article>;
});

export function NewsTimelineView({
  items,
  onItemClick,
  inlineExpandBody = onItemClick == null,
}: {
  items: UnifiedNewsItem[];
  onItemClick?: (item: UnifiedNewsItem) => void;
  inlineExpandBody?: boolean;
}) {
  return (
    <ul className="space-y-0">
      {items.map((item, index) => {
        const previous = items[index - 1];
        const currentTs = newsDisplayTimestamp(item);
        const previousTs = previous ? newsDisplayTimestamp(previous) : null;
        const showMonthHeader =
          !previousTs || !newsTimelineSameMonthYear(previousTs, currentTs);

        return (
          <Fragment key={item.id}>
            {showMonthHeader ? (
              <li
                className={cn(
                  "pb-2",
                  index === 0 ? "pt-0" : "border-t border-border/40 pt-4",
                )}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {formatNewsTimelineMonthYear(currentTs)}
                </p>
              </li>
            ) : null}
            <li className="pb-3 last:pb-0">
              <NewsTimelineRow
                item={item}
                inlineExpandBody={inlineExpandBody}
                showConnectorBelow={index < items.length - 1}
                onClick={onItemClick ? () => onItemClick(item) : undefined}
              />
            </li>
          </Fragment>
        );
      })}
    </ul>
  );
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
  const mediaSrc = preview?.url ?? preview?.thumbUrl ?? null;
  const dateLabel = formatNewsCardDate(item);
  const dateTime = newsDisplayTimestamp(item);
  const previewBody = useMemo(() => newsCardPreviewBody(item.body), [item.body]);
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
        data-embed-mt
        className={cn(
          "text-sm text-muted-foreground",
          showClampedBody ? "line-clamp-4" : "whitespace-pre-wrap",
        )}
      >
        {inlineExpandBody && expanded
          ? stripMarkdownBold(item.body)
          : previewBody}
      </p>
      {canExpandBody || (expanded && externalUrl) ? (
        <NewsFeedBodyActions
          canExpandBody={canExpandBody}
          expanded={expanded}
          externalUrl={externalUrl}
          platform={item.platform}
          onToggleExpanded={toggleExpanded}
        />
      ) : null}
    </div>
  ) : null;

  const cardContent = (
    <>
      {mediaSrc ? (
        <FeedMediaImage
          src={mediaSrc}
          thumbSrc={preview?.url ? preview.thumbUrl : null}
          blurDataUrl={preview.blurDataUrl}
          width={preview.width}
          height={preview.height}
          alt=""
          fit="cover"
          feedOptimized
          clampAspect
        />
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
          <p className="font-medium leading-snug" data-embed-mt>
            {item.title}
          </p>
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

/** Raster — mobil 1 Spalte, Desktop responsive Grid (CSS-only, kein JS-Reflow). */
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
  if (items.length === 0) return null;

  return (
    <div className={feedNewsGridClassName}>
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
    <NewsTimelineView
      items={items}
      onItemClick={onItemClick}
      inlineExpandBody={inlineExpandBody}
    />
  );
}
