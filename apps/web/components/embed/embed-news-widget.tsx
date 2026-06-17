"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EmbedAccentRoot } from "@/components/embed/embed-accent-root";
import { EmbedResizeReporter } from "@/components/embed/embed-resize-reporter";
import {
  NewsListView,
  NewsMasonryGrid,
} from "@/components/news/news-feed-views";
import { NewsPlatformFilterChips } from "@/components/news/news-platform-filter-chips";
import { ListPaginationSurround } from "@/components/ui/list-pagination";
import {
  NEWS_FILTER_ALL,
  type NewsPlatformFilter,
} from "@/lib/constants/news-platforms";
import { paginateListItems } from "@/lib/constants/list-pagination";
import { defaultNewsPlatformFilterWithoutAll } from "@/lib/news/news-embed-platforms";
import type { PublicEmbedNews } from "@/lib/news/public-news-server";
import { NEWS_FEED_PAGE_SIZE } from "@/lib/news/news-feed-pagination";
import type { EmbedTextTheme } from "@/lib/embed/embed-appearance";

export type EmbedNewsWidgetProps = {
  accentHex: string;
  textTheme?: EmbedTextTheme;
  viewMode: "grid" | "list";
  connectedPlatforms: PublicEmbedNews["connectedPlatforms"];
  items: PublicEmbedNews["items"];
  variant?: "embed" | "profileSheet";
  /** Chip „Alle“ in Profil & Einbindung — Standard: an. */
  showAllPlatformFilter?: boolean;
};

export function EmbedNewsWidget({
  accentHex,
  textTheme = "dark",
  viewMode,
  connectedPlatforms,
  items,
  variant = "embed",
  showAllPlatformFilter = true,
}: EmbedNewsWidgetProps) {
  const showAllChip = showAllPlatformFilter !== false;

  const availablePlatforms = useMemo(
    () => new Set(connectedPlatforms),
    [connectedPlatforms],
  );

  const fallbackPlatformFilter = useMemo(
    () => defaultNewsPlatformFilterWithoutAll(connectedPlatforms),
    [connectedPlatforms],
  );

  const [platformFilter, setPlatformFilterState] = useState<NewsPlatformFilter>(
    () => (showAllChip ? NEWS_FILTER_ALL : fallbackPlatformFilter),
  );
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPlatformFilterState((current) => {
      if (!showAllChip) {
        if (current === NEWS_FILTER_ALL || !availablePlatforms.has(current)) {
          return fallbackPlatformFilter;
        }
        return current;
      }
      if (current !== NEWS_FILTER_ALL && !availablePlatforms.has(current)) {
        return NEWS_FILTER_ALL;
      }
      return current;
    });
  }, [showAllChip, availablePlatforms, fallbackPlatformFilter]);

  const resolvedPlatformFilter = useMemo(() => {
    if (!showAllChip) {
      if (platformFilter === NEWS_FILTER_ALL || !availablePlatforms.has(platformFilter)) {
        return fallbackPlatformFilter;
      }
      return platformFilter;
    }
    if (
      platformFilter !== NEWS_FILTER_ALL &&
      !availablePlatforms.has(platformFilter)
    ) {
      return NEWS_FILTER_ALL;
    }
    return platformFilter;
  }, [platformFilter, availablePlatforms, showAllChip, fallbackPlatformFilter]);

  const visibleItems = useMemo(
    () => items.filter((item) => availablePlatforms.has(item.platform)),
    [items, availablePlatforms],
  );

  const filtered = useMemo(() => {
    if (resolvedPlatformFilter === NEWS_FILTER_ALL) return visibleItems;
    return visibleItems.filter((item) => item.platform === resolvedPlatformFilter);
  }, [visibleItems, resolvedPlatformFilter]);

  const setPlatformFilter = useCallback(
    (next: NewsPlatformFilter) => {
      if (!showAllChip && next === NEWS_FILTER_ALL) {
        return;
      }
      if (next !== NEWS_FILTER_ALL && !availablePlatforms.has(next)) {
        return;
      }
      setPlatformFilterState(next);
      setPage(1);
    },
    [availablePlatforms, showAllChip],
  );

  const clientPagination = useMemo(
    () => paginateListItems(filtered, page, NEWS_FEED_PAGE_SIZE),
    [filtered, page],
  );

  const displayItems = clientPagination.items;

  const resizeDeps = useMemo(
    () => [
      viewMode,
      resolvedPlatformFilter,
      displayItems.length,
      clientPagination.page,
      clientPagination.totalCount,
      displayItems.map((i) => `${i.id}:${i.body.length}:${i.media.length}`).join("|"),
    ],
    [viewMode, resolvedPlatformFilter, displayItems, clientPagination],
  );

  const paddingClass =
    variant === "profileSheet" ? "px-0 py-0" : "px-4 py-5 sm:px-6";

  const showPagination =
    clientPagination.totalPages > 1 || clientPagination.totalCount > 0;

  const newsContent =
    viewMode === "list" ? (
      <NewsListView items={displayItems} />
    ) : (
      <NewsMasonryGrid items={displayItems} />
    );

  return (
    <EmbedAccentRoot
      accentHex={accentHex}
      textTheme={textTheme}
      brandFooter={variant !== "profileSheet"}
    >
      <EmbedResizeReporter widget="news" deps={resizeDeps} />
      <div className={paddingClass}>
        {connectedPlatforms.length > 1 ? (
          <div className="mb-4">
            <NewsPlatformFilterChips
              value={resolvedPlatformFilter}
              onChange={setPlatformFilter}
              availablePlatforms={availablePlatforms}
              showAllChip={showAllChip}
            />
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {resolvedPlatformFilter === NEWS_FILTER_ALL
              ? "Noch keine News veröffentlicht."
              : "Keine News für diese Plattform."}
          </p>
        ) : showPagination ? (
          <ListPaginationSurround
            classNameAbove="mb-4 border-b-0 pb-0"
            classNameBelow="mt-4 border-t-0 pt-0"
            page={clientPagination.page}
            totalPages={clientPagination.totalPages}
            shown={displayItems.length}
            totalCount={clientPagination.totalCount}
            itemLabel="Beiträge"
            canPrevious={clientPagination.page > 1}
            canNext={clientPagination.page < clientPagination.totalPages}
            onPrevious={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() =>
              setPage((p) => Math.min(clientPagination.totalPages, p + 1))
            }
          >
            {newsContent}
          </ListPaginationSurround>
        ) : (
          newsContent
        )}
      </div>
    </EmbedAccentRoot>
  );
}
