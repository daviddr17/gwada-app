"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EmbedAccentRoot } from "@/components/embed/embed-accent-root";
import { EmbedResizeReporter } from "@/components/embed/embed-resize-reporter";
import { EventsListView } from "@/components/events/events-feed-views";
import { EventsPlatformFilterChips } from "@/components/events/events-platform-filter-chips";
import { ListPaginationSurround } from "@/components/ui/list-pagination";
import {
  EVENTS_FILTER_ALL,
  type EventsPlatformFilter,
} from "@/lib/constants/events-platforms";
import { paginateListItems } from "@/lib/constants/list-pagination";
import { defaultEventsPlatformFilterWithoutAll } from "@/lib/events/events-embed-platforms";
import { EVENTS_FEED_PAGE_SIZE } from "@/lib/events/events-feed-pagination";
import type { PublicEmbedEvents } from "@/lib/events/public-events-server";
import type { EmbedTextTheme } from "@/lib/embed/embed-appearance";

export type EmbedEventsWidgetProps = {
  accentHex: string;
  textTheme?: EmbedTextTheme;
  viewMode: "grid" | "list";
  connectedPlatforms: PublicEmbedEvents["connectedPlatforms"];
  items: PublicEmbedEvents["items"];
  variant?: "embed" | "profileSheet";
  showAllPlatformFilter?: boolean;
};

export function EmbedEventsWidget({
  accentHex,
  textTheme = "dark",
  connectedPlatforms,
  items,
  variant = "embed",
  showAllPlatformFilter = true,
}: EmbedEventsWidgetProps) {
  const showAllChip = showAllPlatformFilter !== false;
  const availablePlatforms = useMemo(
    () => new Set(connectedPlatforms),
    [connectedPlatforms],
  );
  const fallbackPlatformFilter = useMemo(
    () => defaultEventsPlatformFilterWithoutAll(connectedPlatforms),
    [connectedPlatforms],
  );
  const [platformFilter, setPlatformFilterState] = useState<EventsPlatformFilter>(() =>
    showAllChip ? EVENTS_FILTER_ALL : fallbackPlatformFilter,
  );
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPlatformFilterState((current) => {
      if (!showAllChip) {
        if (current === EVENTS_FILTER_ALL || !availablePlatforms.has(current)) {
          return fallbackPlatformFilter;
        }
        return current;
      }
      if (current !== EVENTS_FILTER_ALL && !availablePlatforms.has(current)) {
        return EVENTS_FILTER_ALL;
      }
      return current;
    });
  }, [showAllChip, availablePlatforms, fallbackPlatformFilter]);

  const resolvedFilter = useMemo(() => {
    if (!showAllChip) {
      if (platformFilter === EVENTS_FILTER_ALL || !availablePlatforms.has(platformFilter)) {
        return fallbackPlatformFilter;
      }
      return platformFilter;
    }
    if (platformFilter !== EVENTS_FILTER_ALL && !availablePlatforms.has(platformFilter)) {
      return EVENTS_FILTER_ALL;
    }
    return platformFilter;
  }, [platformFilter, availablePlatforms, showAllChip, fallbackPlatformFilter]);

  const visibleItems = useMemo(() => {
    const base = items.filter((item) => availablePlatforms.has(item.platform));
    if (resolvedFilter === EVENTS_FILTER_ALL) return base;
    return base.filter((item) => item.platform === resolvedFilter);
  }, [items, availablePlatforms, resolvedFilter]);

  const setPlatformFilter = useCallback(
    (next: EventsPlatformFilter) => {
      if (!showAllChip && next === EVENTS_FILTER_ALL) return;
      if (next !== EVENTS_FILTER_ALL && !availablePlatforms.has(next)) return;
      setPlatformFilterState(next);
      setPage(1);
    },
    [availablePlatforms, showAllChip],
  );

  const clientPagination = useMemo(
    () => paginateListItems(visibleItems, page, EVENTS_FEED_PAGE_SIZE),
    [visibleItems, page],
  );

  const displayItems = clientPagination.items;

  const resizeDeps = useMemo(
    () => [
      resolvedFilter,
      displayItems.length,
      clientPagination.page,
      clientPagination.totalCount,
    ],
    [resolvedFilter, displayItems.length, clientPagination],
  );

  const paddingClass =
    variant === "profileSheet" ? "px-0 py-0" : "px-4 py-5 sm:px-6";

  return (
    <EmbedAccentRoot
      accentHex={accentHex}
      textTheme={textTheme}
      brandFooter={variant !== "profileSheet"}
    >
      <EmbedResizeReporter widget="events" deps={resizeDeps} />
      <div className={paddingClass}>
        {connectedPlatforms.length > 1 ? (
          <div className="mb-4">
            <EventsPlatformFilterChips
              value={resolvedFilter}
              onChange={setPlatformFilter}
              availablePlatforms={availablePlatforms}
              showAllChip={showAllChip}
            />
          </div>
        ) : null}

        <ListPaginationSurround
          classNameAbove="mb-4 border-b-0 pb-0"
          classNameBelow="mt-4 border-t-0 pt-0"
          page={clientPagination.page}
          totalPages={clientPagination.totalPages}
          shown={displayItems.length}
          totalCount={clientPagination.totalCount}
          itemLabel="Events"
          canPrevious={clientPagination.page > 1}
          canNext={clientPagination.page < clientPagination.totalPages}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(clientPagination.totalPages, p + 1))}
        >
          {visibleItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Derzeit keine kommenden Events.</p>
          ) : (
            <EventsListView items={displayItems} />
          )}
        </ListPaginationSurround>
      </div>
    </EmbedAccentRoot>
  );
}
