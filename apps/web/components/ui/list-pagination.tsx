"use client";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

type ListPaginationProps = {
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
};

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
}: ListPaginationProps) {
  if (totalPages <= 1 && !canNext && (totalCount == null || totalCount === 0)) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between",
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
