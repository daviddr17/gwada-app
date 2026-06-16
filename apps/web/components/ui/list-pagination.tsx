"use client";

import type { ReactNode } from "react";
import { PaginationPageControl } from "@/components/ui/pagination";
import { formatListRangeSummaryPart } from "@/lib/ui/list-range-count";
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
};

function listPaginationVisible({
  totalPages,
  canNext,
  totalCount,
  showSummary,
}: Pick<
  ListPaginationProps,
  "totalPages" | "canNext" | "totalCount" | "showSummary"
>) {
  if (showSummary === false) {
    return totalPages > 1 || canNext;
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
}: ListPaginationProps) {
  if (
    !listPaginationVisible({ totalPages, canNext, totalCount, showSummary })
  ) {
    return null;
  }

  const rangeSummary =
    showSummary &&
    formatListRangeSummaryPart({ shown, totalCount, itemLabel });

  const pageNavVisible = showPageNav({ totalPages, canNext });

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
      {rangeSummary ? (
        <p className="min-w-0 text-sm text-muted-foreground tabular-nums">
          {rangeSummary}
        </p>
      ) : (
        <span className="min-w-0 flex-1" aria-hidden />
      )}
      {pageNavVisible ? (
        <PaginationPageControl
          page={page}
          totalPages={Math.max(totalPages, 1)}
          canPrevious={canPrevious}
          canNext={canNext}
          onPrevious={onPrevious}
          onNext={onNext}
          busy={busy}
          className={cn(!rangeSummary && "ml-auto")}
        />
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
        showSummary
        className={classNameBelow}
      />
    </>
  );
}
