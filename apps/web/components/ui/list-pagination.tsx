"use client";

import type { ReactNode } from "react";
import { PaginationPageControl } from "@/components/ui/pagination";
import {
  joinListMetaSummary,
  platformFeedSyncMetaVisible,
  PlatformFeedSyncNowButton,
  formatPlatformFeedSyncMetaText,
  type PlatformFeedListSyncProps,
} from "@/components/platform-feed/platform-feed-sync-status-bar";
import { formatListPageSummary } from "@/lib/ui/list-range-count";
import { cn } from "@/lib/utils";

export type ListPaginationProps = {
  page: number;
  totalPages: number;
  /** Einträge auf der aktuellen Seite (für x/y-Anzeige). */
  shown?: number;
  totalCount?: number;
  itemLabel?: string;
  onPrevious: () => void;
  onNext: () => void;
  canPrevious: boolean;
  canNext: boolean;
  busy?: boolean;
  className?: string;
  /** `above`: oberhalb der Tabelle/Liste; `below`: unterhalb (Standard). */
  placement?: "above" | "below";
  /** Text-Zusammenfassung ausblenden (z. B. nur Seitensteuerung). */
  showSummary?: boolean;
  /** Sync-Status externer Kanäle — nur in der oberen Leiste. */
  feedSync?: PlatformFeedListSyncProps;
};

function listPaginationVisible({
  totalPages,
  canNext,
  totalCount,
  showSummary,
  itemLabel,
  feedSync,
  placement,
}: Pick<
  ListPaginationProps,
  | "totalPages"
  | "canNext"
  | "totalCount"
  | "showSummary"
  | "itemLabel"
  | "feedSync"
  | "placement"
>) {
  if (
    placement === "above" &&
    feedSync &&
    platformFeedSyncMetaVisible(feedSync.syncMeta)
  ) {
    return true;
  }
  if (showSummary === false) {
    return totalPages > 1 || canNext;
  }
  if (totalCount != null && itemLabel?.trim()) {
    return true;
  }
  return !(
    totalPages <= 1 &&
    !canNext &&
    (totalCount == null || totalCount === 0)
  );
}

function showPageNav({
  totalPages,
  canNext,
}: Pick<ListPaginationProps, "totalPages" | "canNext">) {
  return totalPages > 1 || canNext;
}

export function ListPagination({
  page,
  totalPages,
  shown,
  totalCount,
  itemLabel,
  onPrevious,
  onNext,
  canPrevious,
  canNext,
  busy = false,
  className,
  placement = "below",
  showSummary = true,
  feedSync,
}: ListPaginationProps) {
  if (
    !listPaginationVisible({
      totalPages,
      canNext,
      totalCount,
      showSummary,
      itemLabel,
      feedSync,
      placement,
    })
  ) {
    return null;
  }

  const rangeSummary =
    showSummary &&
    formatListPageSummary({
      shown,
      totalCount,
      itemLabel,
      page,
      totalPages,
    });

  const syncSummary =
    placement === "above" &&
    feedSync &&
    platformFeedSyncMetaVisible(feedSync.syncMeta)
      ? formatPlatformFeedSyncMetaText(feedSync.syncMeta!)
      : null;

  const leftSummary = joinListMetaSummary(
    typeof rangeSummary === "string" ? rangeSummary : null,
    syncSummary,
  );

  const pageNavVisible = showPageNav({ totalPages, canNext });

  const showSyncButton =
    placement === "above" &&
    feedSync &&
    platformFeedSyncMetaVisible(feedSync.syncMeta) &&
    (feedSync.syncMeta!.stale || feedSync.syncing);

  return (
    <div
      className={cn(
        "flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1",
        placement === "above"
          ? "border-b border-border/50 pb-4"
          : "border-t border-border/50 pt-4",
        className,
      )}
    >
      {leftSummary ? (
        <p className="min-w-0 text-sm text-muted-foreground tabular-nums">
          {leftSummary}
        </p>
      ) : (
        <span className="min-w-0 flex-1" aria-hidden />
      )}
      {showSyncButton || pageNavVisible ? (
        <div className="flex flex-wrap items-center gap-2">
          {showSyncButton && feedSync ? (
            <PlatformFeedSyncNowButton
              syncing={feedSync.syncing}
              onSyncNow={feedSync.onSyncNow}
            />
          ) : null}
          {pageNavVisible ? (
            <PaginationPageControl
              page={page}
              totalPages={Math.max(totalPages, 1)}
              canPrevious={canPrevious}
              canNext={canNext}
              onPrevious={onPrevious}
              onNext={onNext}
              busy={busy}
              className={cn(!leftSummary && "ml-auto")}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Gleiche Pagination-Leiste oben und unten um Tabelle/Liste — ein Props-Objekt. */
export function ListPaginationSurround({
  children,
  classNameAbove,
  classNameBelow,
  ...paginationProps
}: ListPaginationProps & {
  children: ReactNode;
  classNameAbove?: string;
  classNameBelow?: string;
}) {
  const pageNavVisible = showPageNav({
    totalPages: paginationProps.totalPages,
    canNext: paginationProps.canNext,
  });

  return (
    <>
      <ListPagination
        {...paginationProps}
        placement="above"
        showSummary
        className={classNameAbove}
      />
      {children}
      <ListPagination
        {...paginationProps}
        placement="below"
        showSummary={pageNavVisible}
        className={classNameBelow}
      />
    </>
  );
}
