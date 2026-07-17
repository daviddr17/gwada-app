"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmbedAccentRoot } from "@/components/embed/embed-accent-root";
import { EmbedResizeReporter } from "@/components/embed/embed-resize-reporter";
import { EventsListView } from "@/components/events/events-feed-views";
import { EventsPlatformFilterChips } from "@/components/events/events-platform-filter-chips";
import { Label } from "@/components/ui/label";
import { ListPaginationSurround } from "@/components/ui/list-pagination";
import { Switch } from "@/components/ui/switch";
import type { AppLocale } from "@/i18n/config";
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
  pastItems?: PublicEmbedEvents["pastItems"];
  variant?: "embed" | "profileSheet";
  showAllPlatformFilter?: boolean;
  sourceLocale?: AppLocale;
};

export function EmbedEventsWidget({
  accentHex,
  textTheme = "dark",
  viewMode,
  connectedPlatforms,
  items,
  pastItems = [],
  variant = "embed",
  showAllPlatformFilter = true,
  sourceLocale = "de",
}: EmbedEventsWidgetProps) {
  return (
    <EmbedAccentRoot
      accentHex={accentHex}
      textTheme={textTheme}
      brandFooter={variant !== "profileSheet"}
      sourceLocale={sourceLocale}
      showLocalePicker={variant === "embed"}
    >
      <EmbedEventsWidgetBody
        viewMode={viewMode}
        connectedPlatforms={connectedPlatforms}
        items={items}
        pastItems={pastItems}
        variant={variant}
        showAllPlatformFilter={showAllPlatformFilter}
      />
    </EmbedAccentRoot>
  );
}

function EmbedEventsWidgetBody({
  connectedPlatforms,
  items,
  pastItems = [],
  variant = "embed",
  showAllPlatformFilter = true,
}: Omit<EmbedEventsWidgetProps, "accentHex" | "textTheme" | "sourceLocale">) {
  const t = useTranslations("Embed");
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
  const [showPastEvents, setShowPastEvents] = useState(false);
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

  const filterByPlatform = useCallback(
    (list: PublicEmbedEvents["items"]) => {
      const base = list.filter((item) => availablePlatforms.has(item.platform));
      if (resolvedFilter === EVENTS_FILTER_ALL) return base;
      return base.filter((item) => item.platform === resolvedFilter);
    },
    [availablePlatforms, resolvedFilter],
  );

  const visibleUpcoming = useMemo(
    () => filterByPlatform(items),
    [items, filterByPlatform],
  );

  const visiblePast = useMemo(
    () => filterByPlatform(pastItems),
    [pastItems, filterByPlatform],
  );

  const hasPastEvents = visiblePast.length > 0;

  const visibleItems = useMemo(() => {
    if (!showPastEvents) return visibleUpcoming;
    return [...visibleUpcoming, ...visiblePast];
  }, [visibleUpcoming, visiblePast, showPastEvents]);

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
      showPastEvents,
      displayItems.length,
      clientPagination.page,
      clientPagination.totalCount,
      hasPastEvents,
      displayItems.map((i) => `${i.id}:${i.title.length}:${i.coverUrl ?? ""}`).join("|"),
    ],
    [
      resolvedFilter,
      showPastEvents,
      displayItems,
      clientPagination.page,
      clientPagination.totalCount,
      hasPastEvents,
    ],
  );

  const paddingClass =
    variant === "profileSheet" ? "px-0 py-0" : "px-4 py-5 sm:px-6";

  return (
    <>
      <EmbedResizeReporter widget="events" deps={resizeDeps} />
      <div className={paddingClass} data-gwada-embed-content>
        {connectedPlatforms.length > 1 ? (
          <div className="mb-4">
            <EventsPlatformFilterChips
              value={resolvedFilter}
              onChange={setPlatformFilter}
              availablePlatforms={availablePlatforms}
              showAllChip={showAllChip}
              allLabel={t("filterAll")}
            />
          </div>
        ) : null}

        {hasPastEvents ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 rounded-full border border-border/50 bg-muted/30 px-3 py-1.5">
              <Label
                htmlFor="embed-show-past-events"
                className="cursor-pointer text-xs text-muted-foreground"
              >
                {t("eventsShowPast")}
              </Label>
              <Switch
                id="embed-show-past-events"
                checked={showPastEvents}
                onCheckedChange={(checked) => {
                  setShowPastEvents(checked === true);
                  setPage(1);
                }}
                size="sm"
              />
            </div>
            {!showPastEvents ? (
              <p className="text-xs text-muted-foreground">
                {t("eventsPastHidden", { count: visiblePast.length })}
              </p>
            ) : null}
          </div>
        ) : null}

        <ListPaginationSurround
          classNameAbove="mb-4 border-b-0 pb-0"
          classNameBelow="mt-4 border-t-0 pt-0"
          page={clientPagination.page}
          totalPages={clientPagination.totalPages}
          shown={displayItems.length}
          totalCount={clientPagination.totalCount}
          itemLabel={t("events")}
          canPrevious={clientPagination.page > 1}
          canNext={clientPagination.page < clientPagination.totalPages}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(clientPagination.totalPages, p + 1))}
        >
          {visibleItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("eventsEmpty")}</p>
          ) : (
            <EventsListView items={displayItems} />
          )}
        </ListPaginationSurround>
      </div>
    </>
  );
}
