"use client";

import { memo } from "react";
import { ExternalLink, Ticket } from "lucide-react";
import { EventsPlatformIcon } from "@/components/events/events-platform-icon";
import {
  EVENTS_PLATFORM_LABELS,
} from "@/lib/constants/events-platforms";
import {
  formatEventCardDate,
  formatEventDateRange,
} from "@/lib/events/format-events-display-date";
import type { UnifiedEventItem } from "@/lib/events/unified-event-item";
import { Badge } from "@/components/ui/badge";
import { FeedPinnedBadge } from "@/components/feed-pin/feed-pinned-badge";
import { feedPinnedItemSurfaceClassName } from "@/lib/ui/feed-pin-styles";
import { cn } from "@/lib/utils";

const cardClassName =
  "flex w-full flex-col overflow-hidden rounded-xl border border-border/50 bg-card text-left shadow-card transition hover:border-border";

const EventCard = memo(function EventCard({
  item,
  onClick,
  masonry = false,
}: {
  item: UnifiedEventItem;
  onClick?: () => void;
  masonry?: boolean;
}) {
  const dateLabel = formatEventCardDate(item);
  const fullRange = formatEventDateRange(item);

  const content = (
    <>
      {item.coverUrl ? (
        <div className="relative w-full shrink-0 bg-muted/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="block max-h-48 w-full object-cover"
          />
        </div>
      ) : null}
      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="secondary" className="gap-1.5">
            <EventsPlatformIcon platform={item.platform} className="size-3" />
            {EVENTS_PLATFORM_LABELS[item.platform]}
          </Badge>
          {item.isPinned ? <FeedPinnedBadge /> : null}
          <time className="shrink-0 text-xs text-muted-foreground" dateTime={item.startAt} title={fullRange}>
            {dateLabel}
          </time>
        </div>
        <p className="font-medium leading-snug">{item.title}</p>
        {item.description ? (
          <p className="line-clamp-3 text-sm text-muted-foreground whitespace-pre-wrap">
            {item.description}
          </p>
        ) : null}
        {item.location ? (
          <p className="text-xs text-muted-foreground">📍 {item.location}</p>
        ) : null}
        {item.ticketUrl ? (
          <p className="inline-flex items-center gap-1 text-xs font-medium text-accent">
            <Ticket className="size-3.5" />
            Tickets verfügbar
          </p>
        ) : null}
      </div>
    </>
  );

  const surfaceClassName = cn(
    cardClassName,
    masonry && "mb-4 break-inside-avoid",
    item.isPinned && feedPinnedItemSurfaceClassName,
    onClick && "cursor-pointer hover:shadow-card active:scale-[0.99]",
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={surfaceClassName}>
        {content}
      </button>
    );
  }

  return <article className={surfaceClassName}>{content}</article>;
});

export function EventsListView({
  items,
  onItemClick,
}: {
  items: UnifiedEventItem[];
  onItemClick?: (item: UnifiedEventItem) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <EventCard key={item.id} item={item} onClick={onItemClick ? () => onItemClick(item) : undefined} />
      ))}
    </div>
  );
}

export function EventsMasonryGrid({
  items,
  onItemClick,
}: {
  items: UnifiedEventItem[];
  onItemClick?: (item: UnifiedEventItem) => void;
}) {
  return (
    <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
      {items.map((item) => (
        <EventCard
          key={item.id}
          item={item}
          masonry
          onClick={onItemClick ? () => onItemClick(item) : undefined}
        />
      ))}
    </div>
  );
}

export function EventsDetailActions({ item }: { item: UnifiedEventItem }) {
  const ticketUrl = item.ticketUrl?.trim();
  const externalUrl = item.externalUrl?.trim();
  if (!ticketUrl && !externalUrl) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {ticketUrl ? (
        <a
          href={ticketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-2 text-sm font-medium hover:border-border"
        >
          <Ticket className="size-4" />
          Tickets
        </a>
      ) : null}
      {externalUrl ? (
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-2 text-sm font-medium hover:border-border"
        >
          <ExternalLink className="size-4" />
          Auf {EVENTS_PLATFORM_LABELS[item.platform]} öffnen
        </a>
      ) : null}
    </div>
  );
}
