"use client";

import type { ReactNode } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
  /** Text-Zusammenfassung ausblenden (z. B. unten nur Vor/Zurück). */
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

  const summary =
    showSummary &&
    formatListPageSummary({
      shown,
      totalCount,
      itemLabel,
      page,
      totalPages,
    });

  return (
    <div
      className={cn(
        "flex flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2",
        placement === "above"
          ? "border-b border-border/50 pb-4"
          : "border-t border-border/50 pt-4",
        className,
      )}
    >
      {summary ? (
        <p className="min-w-0 text-sm text-muted-foreground tabular-nums">
          {summary}
        </p>
      ) : (
        <span className="min-w-0 flex-1" aria-hidden />
      )}
      <Pagination className="mx-0 w-auto shrink-0 justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              disabled={!canPrevious || busy}
              onClick={onPrevious}
              aria-label="Vorherige Seite"
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              disabled={!canNext || busy}
              onClick={onNext}
              aria-label="Nächste Seite"
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
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
        showSummary={false}
        className={classNameBelow}
      />
    </>
  );
}
