"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EmbedAccentRoot } from "@/components/embed/embed-accent-root";
import { EmbedFeedResizeReporter } from "@/components/embed/embed-feed-resize-reporter";
import { EmbedMeasureEnd } from "@/components/embed/embed-measure-boundary";
import {
  countNewsFeedImages,
  FeedScreenLayoutStable,
} from "@/components/feed/feed-screen-layout-stable";
import {
  NewsListView,
  NewsMasonryGrid,
} from "@/components/news/news-feed-views";
import { NewsPlatformFilterChips } from "@/components/news/news-platform-filter-chips";
import { NewsStoriesRow } from "@/components/news/news-stories-row";
import { NewsStoryViewer } from "@/components/news/news-story-viewer";
import { ListPaginationSurround } from "@/components/ui/list-pagination";
import {
  NEWS_FILTER_ALL,
  type NewsPlatformFilter,
} from "@/lib/constants/news-platforms";
import { paginateListItems } from "@/lib/constants/list-pagination";
import { defaultNewsPlatformFilterWithoutAll } from "@/lib/news/news-embed-platforms";
import { dedupeCrossPlatformNewsItems } from "@/lib/news/dedupe-cross-platform-news";
import type { PublicEmbedNews } from "@/lib/news/public-news-server";
import { NEWS_FEED_PAGE_SIZE } from "@/lib/news/news-feed-pagination";
import type { UnifiedNewsStoryRing } from "@/lib/news/unified-news-story";
import type { EmbedTextTheme } from "@/lib/embed/embed-appearance";
import { EMBED_NEWS_STORY_VIEWPORT_PX } from "@/lib/embed/embed-resize-config";

export type EmbedNewsWidgetProps = {
  accentHex: string;
  textTheme?: EmbedTextTheme;
  viewMode: "grid" | "list";
  connectedPlatforms: PublicEmbedNews["connectedPlatforms"];
  items: PublicEmbedNews["items"];
  storyRings?: UnifiedNewsStoryRing[];
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
  storyRings = [],
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
  const [activeRing, setActiveRing] = useState<UnifiedNewsStoryRing | null>(null);
  const [storyOpen, setStoryOpen] = useState(false);

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
    if (resolvedPlatformFilter === NEWS_FILTER_ALL) {
      return dedupeCrossPlatformNewsItems(visibleItems);
    }
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
      storyRings.length,
      clientPagination.page,
      clientPagination.totalCount,
      displayItems.map((i) => i.id).join(","),
    ],
    [viewMode, resolvedPlatformFilter, displayItems, storyRings.length, clientPagination],
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
      <FeedScreenLayoutStable imageCount={countNewsFeedImages(displayItems)}>
        <EmbedFeedResizeReporter
          widget="news"
          deps={[...resizeDeps, storyOpen]}
          resizeMode={storyOpen && variant === "embed" ? "viewport" : "content"}
          viewportHeightPx={
            storyOpen && variant === "embed" ? EMBED_NEWS_STORY_VIEWPORT_PX : undefined
          }
        />
        <div className={paddingClass} data-gwada-embed-content>
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

        {storyRings.length > 0 ? (
          <div className="mb-4">
            <NewsStoriesRow
              storyRings={storyRings}
              onRingClick={(ring) => {
                setActiveRing(ring);
                setStoryOpen(true);
              }}
            />
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <ListPaginationSurround
            classNameAbove="mb-4 border-b-0 pb-0"
            classNameBelow="mt-4 border-t-0 pt-0"
            page={clientPagination.page}
            totalPages={clientPagination.totalPages}
            shown={0}
            totalCount={0}
            itemLabel="Beiträge"
            canPrevious={false}
            canNext={false}
            onPrevious={() => setPage(1)}
            onNext={() => setPage(1)}
          >
            <p className="text-sm text-muted-foreground">
              {resolvedPlatformFilter === NEWS_FILTER_ALL
                ? "Noch keine News veröffentlicht."
                : "Keine News für diese Plattform."}
            </p>
          </ListPaginationSurround>
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
        <EmbedMeasureEnd />
        </div>
      </FeedScreenLayoutStable>
      <NewsStoryViewer
        ring={activeRing}
        open={storyOpen}
        onOpenChange={setStoryOpen}
      />
    </EmbedAccentRoot>
  );
}
