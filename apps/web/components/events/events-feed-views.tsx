"use client";

import { Fragment, memo, useState } from "react";
import { CalendarDays, ExternalLink, MapPin, Ticket } from "lucide-react";
import { useTranslations } from "next-intl";
import { EventsPlatformIcon } from "@/components/events/events-platform-icon";
import { EVENTS_PLATFORM_LABELS } from "@/lib/constants/events-platforms";
import {
  eventTimelineSameMonthYear,
  formatEventCardDate,
  formatEventDateRange,
  formatEventTimelineDay,
  formatEventTimelineMonthShort,
  formatEventTimelineMonthYear,
  isEventPast,
} from "@/lib/events/format-events-display-date";
import type { UnifiedEventItem } from "@/lib/events/unified-event-item";
import { Badge } from "@/components/ui/badge";
import { feedTimelineDateChipClassName } from "@/components/feed/feed-timeline-date-skeleton";
import { FeedPinnedBadge } from "@/components/feed-pin/feed-pinned-badge";
import { feedPinnedItemSurfaceClassName } from "@/lib/ui/feed-pin-styles";
import { cn } from "@/lib/utils";

const timelineRowSurfaceClassName =
  "flex min-w-0 flex-1 gap-3 rounded-xl border border-border/50 bg-card p-3 text-left shadow-card transition sm:gap-4 sm:p-3.5";

const timelineThumbClassName =
  "size-[4.5rem] shrink-0 overflow-hidden rounded-lg bg-muted/30 sm:size-20";

const EventTimelineThumb = memo(function EventTimelineThumb({
  coverUrl,
  title,
}: {
  coverUrl: string | null;
  title: string;
}) {
  const [coverBroken, setCoverBroken] = useState(false);
  const showCover = Boolean(coverUrl) && !coverBroken;

  if (showCover) {
    return (
      <div className={timelineThumbClassName}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverUrl!}
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
      <CalendarDays className="size-6 sm:size-7" />
      <span className="sr-only">{title}</span>
    </div>
  );
});

const EventTimelineRow = memo(function EventTimelineRow({
  item,
  onClick,
  showConnectorBelow,
}: {
  item: UnifiedEventItem;
  onClick?: () => void;
  showConnectorBelow: boolean;
}) {
  const t = useTranslations("Embed.eventsUi");
  const fullRange = formatEventDateRange(item);
  const timeLabel = formatEventCardDate(item);
  const past = isEventPast(item);

  const body = (
    <>
      <div className="relative flex w-14 shrink-0 flex-col items-center sm:w-16">
        <div
          className={cn(
            feedTimelineDateChipClassName,
            past && "opacity-80",
          )}
        >
          <span className="text-xl font-semibold tabular-nums leading-none sm:text-2xl">
            {formatEventTimelineDay(item.startAt)}
          </span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {formatEventTimelineMonthShort(item.startAt)}
          </span>
        </div>
        {showConnectorBelow ? (
          <div
            className="absolute top-[calc(100%-0.25rem)] bottom-0 w-px bg-border/60"
            aria-hidden
          />
        ) : null}
      </div>

      <div
        className={cn(
          timelineRowSurfaceClassName,
          item.isPinned && feedPinnedItemSurfaceClassName,
          past && "opacity-90",
          onClick && "group-hover/row:border-border group-active/row:scale-[0.995]",
        )}
      >
        <EventTimelineThumb coverUrl={item.coverUrl} title={item.title} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="gap-1.5">
                <EventsPlatformIcon platform={item.platform} className="size-3" />
                {EVENTS_PLATFORM_LABELS[item.platform]}
              </Badge>
              {item.isPinned ? <FeedPinnedBadge /> : null}
              {past ? (
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("past")}
                </span>
              ) : null}
            </div>
            <time
              className="shrink-0 text-xs text-muted-foreground tabular-nums"
              dateTime={item.startAt}
              title={fullRange}
            >
              {timeLabel}
            </time>
          </div>
          <p className="font-medium leading-snug" data-embed-mt>
            {item.title}
          </p>
          {item.description ? (
            <p
              className="line-clamp-2 text-sm text-muted-foreground whitespace-pre-wrap"
              data-embed-mt
            >
              {item.description}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {item.location ? (
              <span className="inline-flex min-w-0 items-center gap-1 truncate">
                <MapPin className="size-3.5 shrink-0 text-accent" aria-hidden />
                <span className="truncate" data-embed-mt>
                  {item.location}
                </span>
              </span>
            ) : null}
            {item.ticketUrl ? (
              onClick ? (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Ticket className="size-3.5 shrink-0" />
                  {t("tickets")}
                </span>
              ) : (
                <a
                  href={item.ticketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-accent underline-offset-2 hover:underline"
                >
                  <Ticket className="size-3.5 shrink-0" />
                  {t("tickets")}
                </a>
              )
            ) : null}
          </div>
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

export function EventsTimelineView({
  items,
  onItemClick,
}: {
  items: UnifiedEventItem[];
  onItemClick?: (item: UnifiedEventItem) => void;
}) {
  return (
    <ul className="space-y-0">
      {items.map((item, index) => {
        const previous = items[index - 1];
        const showMonthHeader =
          !previous || !eventTimelineSameMonthYear(previous.startAt, item.startAt);

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
                  {formatEventTimelineMonthYear(item.startAt)}
                </p>
              </li>
            ) : null}
            <li className="pb-3 last:pb-0">
              <EventTimelineRow
                item={item}
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

/** Chronologische Timeline — Dashboard und Embed. */
export function EventsListView(props: {
  items: UnifiedEventItem[];
  onItemClick?: (item: UnifiedEventItem) => void;
}) {
  return <EventsTimelineView {...props} />;
}

export function EventsDetailActions({ item }: { item: UnifiedEventItem }) {
  const t = useTranslations("Embed.eventsUi");
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
          {t("tickets")}
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
