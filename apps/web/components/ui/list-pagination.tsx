"use client";

import type { ReactNode } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

export type ListPaginationProps = {
  page: number;
  totalPages: number;
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
};

function listPaginationVisible({
  totalPages,
  canNext,
  totalCount,
}: Pick<ListPaginationProps, "totalPages" | "canNext" | "totalCount">) {
  return !(
    totalPages <= 1 &&
    !canNext &&
    (totalCount == null || totalCount === 0)
  );
}

export function ListPagination({
  page,
  totalPages,
  totalCount,
  itemLabel,
  onPrevious,
  onNext,
  canPrevious,
  canNext,
  busy = false,
  className,
  placement = "below",
}: ListPaginationProps) {
  if (!listPaginationVisible({ totalPages, canNext, totalCount })) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        placement === "above"
          ? "border-b border-border/50 pb-4"
          : "border-t border-border/50 pt-4",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground tabular-nums">
        {totalCount != null && itemLabel ? (
          <>
            <span className="font-medium text-foreground">{totalCount}</span>{" "}
            {itemLabel}
            {" · "}
          </>
        ) : null}
        Seite{" "}
        <span className="font-medium text-foreground">{page}</span>
        {" / "}
        <span className="font-medium text-foreground">{totalPages}</span>
      </p>
      <Pagination className="mx-0 w-auto justify-end">
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
        className={classNameAbove}
      />
      {children}
      <ListPagination
        {...paginationProps}
        placement="below"
        className={classNameBelow}
      />
    </>
  );
}
