"use client";

import type { ReactNode } from "react";
import { PaginationPageControl } from "@/components/ui/pagination";
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
}: ReviewsPaginationProps) {
  if (totalPages <= 1 && !canNext) return null;

  return (
    <div
      className={cn(
        "flex flex-row flex-wrap items-center justify-end gap-x-3 gap-y-1",
        placement === "above"
          ? "border-b border-border/50 pb-4"
          : "border-t border-border/50 pt-4",
        className,
      )}
    >
      <PaginationPageControl
        page={page}
        totalPages={Math.max(totalPages, 1)}
        canPrevious={canPrevious}
        canNext={canNext}
        onPrevious={onPrevious}
        onNext={onNext}
        busy={busy}
      />
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
