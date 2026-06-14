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
}: ReviewsPaginationProps) {
  if (totalPages <= 1 && !canNext) return null;

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
        className={classNameAbove}
      />
      {children}
      <ReviewsPagination
        {...paginationProps}
        placement="below"
        className={classNameBelow}
      />
    </>
  );
}
