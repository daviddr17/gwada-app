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

export type ReviewsPaginationProps = {
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
  canPrevious: boolean;
  canNext: boolean;
  busy?: boolean;
  className?: string;
  placement?: "above" | "below";
  showSummary?: boolean;
};

export function ReviewsPagination({
  page,
  totalPages,
  onPrevious,
  onNext,
  canPrevious,
  canNext,
  busy = false,
  className,
  placement = "below",
  showSummary = true,
}: ReviewsPaginationProps) {
  if (totalPages <= 1 && !canNext) return null;
  if (showSummary === false && totalPages <= 1 && !canNext) return null;

  const summary =
    showSummary && totalPages > 1 ? `Seite ${page}/${totalPages}` : null;

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

export function ReviewsPaginationSurround({
  children,
  classNameAbove,
  classNameBelow,
  ...paginationProps
}: ReviewsPaginationProps & {
  children: ReactNode;
  classNameAbove?: string;
  classNameBelow?: string;
}) {
  return (
    <>
      <ReviewsPagination
        {...paginationProps}
        placement="above"
        showSummary
        className={classNameAbove}
      />
      {children}
      <ReviewsPagination
        {...paginationProps}
        placement="below"
        showSummary={false}
        className={classNameBelow}
      />
    </>
  );
}
