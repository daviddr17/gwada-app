"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import type {
  PublicEmbedNews,
  PublicEmbedNewsPagination,
} from "@/lib/news/public-news-server";
import { NEWS_FEED_PAGE_SIZE } from "@/lib/news/news-feed-pagination";
export type EmbedNewsWidgetProps = {
  accentHex: string;
  viewMode: "grid" | "list";
  connectedPlatforms: PublicEmbedNews["connectedPlatforms"];
  items: PublicEmbedNews["items"];
  variant?: "embed" | "profileSheet";
  /** Server-Pagination (Embed-Route) — x/y + Seiten unten. */
  pagination?: PublicEmbedNewsPagination;
};

function patchEmbedNewsQuery(
  params: URLSearchParams,
  patch: { page?: number; platform?: NewsPlatformFilter },
) {
  if (patch.page != null) {
    if (patch.page <= 1) params.delete("page");
    else params.set("page", String(patch.page));
  }
  if (patch.platform != null) {
    if (patch.platform === NEWS_FILTER_ALL) params.delete("platform");
    else params.set("platform", patch.platform);
  }
}

export function EmbedNewsWidget({
  accentHex,
  viewMode,
  connectedPlatforms,
  items,
  variant = "embed",
  pagination,
}: EmbedNewsWidgetProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [localPlatformFilter, setLocalPlatformFilter] =
    useState<NewsPlatformFilter>(NEWS_FILTER_ALL);
  const [localPage, setLocalPage] = useState(1);
  const [navigating, startTransition] = useTransition();
  const paginated = pagination != null && variant === "embed";
  const profilePaginated = variant === "profileSheet";

  const rawPlatformFilter = paginated
    ? (pagination.platformFilter ?? NEWS_FILTER_ALL)
    : localPlatformFilter;

  const availablePlatforms = useMemo(
    () => new Set(connectedPlatforms),
    [connectedPlatforms],
  );

  const platformFilter = useMemo(() => {
    if (
      rawPlatformFilter !== NEWS_FILTER_ALL &&
      !availablePlatforms.has(rawPlatformFilter)
    ) {
      return NEWS_FILTER_ALL;
    }
    return rawPlatformFilter;
  }, [rawPlatformFilter, availablePlatforms]);

  const visibleItems = useMemo(
    () =>
      paginated
        ? items
        : items.filter((item) => availablePlatforms.has(item.platform)),
    [items, availablePlatforms, paginated],
  );

  const filtered = useMemo(() => {
    if (paginated) return visibleItems;
    if (platformFilter === NEWS_FILTER_ALL) return visibleItems;
    return visibleItems.filter((item) => item.platform === platformFilter);
  }, [visibleItems, platformFilter, paginated]);

  const pushQuery = useCallback(
    (patch: { page?: number; platform?: NewsPlatformFilter }) => {
      const params = new URLSearchParams(searchParams.toString());
      patchEmbedNewsQuery(params, patch);
      const nextQs = params.toString();
      const currentQs = searchParams.toString();
      if (nextQs === currentQs) return;

      startTransition(() => {
        router.push(nextQs ? `${pathname}?${nextQs}` : pathname, {
          scroll: false,
        });
      });
    },
    [router, pathname, searchParams],
  );

  const setPlatformFilter = useCallback(
    (next: NewsPlatformFilter) => {
      if (
        next !== NEWS_FILTER_ALL &&
        !availablePlatforms.has(next)
      ) {
        return;
      }
      if (paginated) {
        pushQuery({ platform: next, page: 1 });
        return;
      }
      setLocalPlatformFilter(next);
      setLocalPage(1);
    },
    [paginated, pushQuery, availablePlatforms],
  );

  useEffect(() => {
    if (!paginated) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [paginated, pagination?.page, pagination?.platformFilter]);

  useEffect(() => {
    if (!profilePaginated) return;
    setLocalPage(1);
  }, [profilePaginated, platformFilter]);

  const clientPagination = useMemo(() => {
    if (!profilePaginated) return null;
    return paginateListItems(filtered, localPage, NEWS_FEED_PAGE_SIZE);
  }, [profilePaginated, filtered, localPage]);

  const displayItems = paginated
    ? filtered
    : profilePaginated
      ? clientPagination!.items
      : filtered;

  const resizeDeps = useMemo(
    () => [
      viewMode,
      platformFilter,
      displayItems.length,
      pagination?.page ?? clientPagination?.page ?? 1,
      pagination?.totalCount ??
        clientPagination?.totalCount ??
        filtered.length,
      displayItems.map((i) => `${i.id}:${i.body.length}:${i.media.length}`).join("|"),
    ],
    [viewMode, platformFilter, displayItems, pagination, clientPagination, filtered.length],
  );

  const paddingClass =
    variant === "profileSheet" ? "px-0 py-0" : "px-4 py-5 sm:px-6";

  const showServerPagination =
    paginated &&
    pagination != null &&
    (pagination.totalPages > 1 || pagination.totalCount > 0);

  const showClientPagination =
    profilePaginated &&
    clientPagination != null &&
    (clientPagination.totalPages > 1 || clientPagination.totalCount > 0);

  const newsContent =
    viewMode === "list" ? (
      <NewsListView items={displayItems} />
    ) : (
      <NewsMasonryGrid items={displayItems} />
    );

  return (
    <EmbedAccentRoot accentHex={accentHex} brandFooter={variant !== "profileSheet"}>
      <EmbedResizeReporter widget="news" deps={resizeDeps} />
      <div className={paddingClass}>
        {connectedPlatforms.length > 1 ? (
          <div className="mb-4">
            <NewsPlatformFilterChips
              value={platformFilter}
              onChange={setPlatformFilter}
              availablePlatforms={availablePlatforms}
            />
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {platformFilter === NEWS_FILTER_ALL
              ? "Noch keine News veröffentlicht."
              : "Keine News für diese Plattform."}
          </p>
        ) : showServerPagination && pagination ? (
          <ListPaginationSurround
            classNameAbove="mb-4 border-b-0 pb-0"
            classNameBelow="mt-4 border-t-0 pt-0"
            page={pagination.page}
            totalPages={pagination.totalPages}
            shown={displayItems.length}
            totalCount={pagination.totalCount}
            itemLabel="Beiträge"
            canPrevious={pagination.page > 1}
            canNext={pagination.page < pagination.totalPages}
            busy={navigating}
            onPrevious={() => pushQuery({ page: pagination.page - 1 })}
            onNext={() => pushQuery({ page: pagination.page + 1 })}
          >
            {newsContent}
          </ListPaginationSurround>
        ) : showClientPagination && clientPagination ? (
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
            onPrevious={() => setLocalPage((p) => Math.max(1, p - 1))}
            onNext={() =>
              setLocalPage((p) => Math.min(clientPagination.totalPages, p + 1))
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
